import { describe, it, expect } from "vitest";
import { evaluateNode } from "./node-evaluator.js";
import type { Fact, RuleNode } from "rules-schema";

const makeFact = (key: string, value: unknown): Fact => ({
  key,
  value,
  source: "user_entered",
  collected_at: "2025-01-01",
  confirmed_by_user: true,
});

const EVAL_DATE = "2025-06-15";

describe("node-evaluator — leaf predicates", () => {
  it("eq: TRUE when value matches", () => {
    const node: RuleNode = { id: "t1", type: "eq", fact: "applicant.is_student", value: true, explain: { en: "Must be a student." } };
    const result = evaluateNode(node, [makeFact("applicant.is_student", true)], EVAL_DATE);
    expect(result.outcome).toBe("TRUE");
  });

  it("eq: FALSE when value does not match", () => {
    const node: RuleNode = { id: "t1", type: "eq", fact: "applicant.is_student", value: true, explain: { en: "Must be a student." } };
    const result = evaluateNode(node, [makeFact("applicant.is_student", false)], EVAL_DATE);
    expect(result.outcome).toBe("FALSE");
  });

  it("in: TRUE when value in list", () => {
    const node: RuleNode = { id: "t1", type: "in", fact: "applicant.category", values: ["sc", "st"], explain: { en: "Must be SC/ST." } };
    const result = evaluateNode(node, [makeFact("applicant.category", "sc")], EVAL_DATE);
    expect(result.outcome).toBe("TRUE");
  });

  it("income_lte: TRUE when income at or below threshold", () => {
    const node: RuleNode = { id: "t1", type: "income_lte", fact: "household.annual_income", value: 250000, explain: { en: "Income ≤ 2.5L" } };
    const result = evaluateNode(node, [makeFact("household.annual_income", 250000)], EVAL_DATE);
    expect(result.outcome).toBe("TRUE");
  });

  it("income_lte: FALSE when income above threshold", () => {
    const node: RuleNode = { id: "t1", type: "income_lte", fact: "household.annual_income", value: 250000, explain: { en: "Income ≤ 2.5L" } };
    const result = evaluateNode(node, [makeFact("household.annual_income", 250001)], EVAL_DATE);
    expect(result.outcome).toBe("FALSE");
  });

  it("age_between: TRUE when age in range", () => {
    const node: RuleNode = { id: "t1", type: "age_between", fact: "applicant.dob", min: 18, max: 60, reference: "evaluation_date", explain: { en: "Age 18-60" } };
    const result = evaluateNode(node, [makeFact("applicant.dob", "1990-03-15")], EVAL_DATE);
    expect(result.outcome).toBe("TRUE");
  });

  it("age_between: FALSE when too young", () => {
    const node: RuleNode = { id: "t1", type: "age_between", fact: "applicant.dob", min: 18, max: 60, reference: "evaluation_date", explain: { en: "Age 18-60" } };
    const result = evaluateNode(node, [makeFact("applicant.dob", "2015-01-01")], EVAL_DATE);
    expect(result.outcome).toBe("FALSE");
  });

  it("UNKNOWN when fact is missing", () => {
    const node: RuleNode = { id: "t1", type: "eq", fact: "applicant.is_student", value: true, explain: { en: "Must be a student." } };
    const result = evaluateNode(node, [], EVAL_DATE);
    expect(result.outcome).toBe("UNKNOWN");
  });

  it("location_in: TRUE when location matches", () => {
    const node: RuleNode = { id: "t1", type: "location_in", fact: "applicant.state_of_domicile", values: ["KA", "MH"], explain: { en: "Must be KA or MH domicile." } };
    const result = evaluateNode(node, [makeFact("applicant.state_of_domicile", "KA")], EVAL_DATE);
    expect(result.outcome).toBe("TRUE");
  });

  it("has_document: TRUE when document present", () => {
    const node: RuleNode = { id: "t1", type: "has_document", fact: "document.aadhaar", explain: { en: "Aadhaar required." } };
    const result = evaluateNode(node, [makeFact("document.aadhaar", true)], EVAL_DATE);
    expect(result.outcome).toBe("TRUE");
  });
});

describe("node-evaluator — combinators", () => {
  it("all: TRUE when all children TRUE", () => {
    const node: RuleNode = {
      id: "root", type: "all", children: [
        { id: "c1", type: "eq", fact: "applicant.is_student", value: true, explain: { en: "Student" } },
        { id: "c2", type: "eq", fact: "applicant.is_bpl", value: true, explain: { en: "BPL" } },
      ],
    };
    const facts = [makeFact("applicant.is_student", true), makeFact("applicant.is_bpl", true)];
    expect(evaluateNode(node, facts, EVAL_DATE).outcome).toBe("TRUE");
  });

  it("all: FALSE when any child FALSE", () => {
    const node: RuleNode = {
      id: "root", type: "all", children: [
        { id: "c1", type: "eq", fact: "applicant.is_student", value: true, explain: { en: "Student" } },
        { id: "c2", type: "eq", fact: "applicant.is_bpl", value: true, explain: { en: "BPL" } },
      ],
    };
    const facts = [makeFact("applicant.is_student", true), makeFact("applicant.is_bpl", false)];
    expect(evaluateNode(node, facts, EVAL_DATE).outcome).toBe("FALSE");
  });

  it("all: UNKNOWN when no FALSE but some UNKNOWN", () => {
    const node: RuleNode = {
      id: "root", type: "all", children: [
        { id: "c1", type: "eq", fact: "applicant.is_student", value: true, explain: { en: "Student" } },
        { id: "c2", type: "eq", fact: "applicant.is_bpl", value: true, explain: { en: "BPL" } },
      ],
    };
    const facts = [makeFact("applicant.is_student", true)]; // is_bpl missing → UNKNOWN
    expect(evaluateNode(node, facts, EVAL_DATE).outcome).toBe("UNKNOWN");
  });

  it("any: TRUE when at least one child TRUE", () => {
    const node: RuleNode = {
      id: "root", type: "any", children: [
        { id: "c1", type: "eq", fact: "applicant.is_student", value: true, explain: { en: "Student" } },
        { id: "c2", type: "eq", fact: "applicant.is_bpl", value: true, explain: { en: "BPL" } },
      ],
    };
    const facts = [makeFact("applicant.is_student", true), makeFact("applicant.is_bpl", false)];
    expect(evaluateNode(node, facts, EVAL_DATE).outcome).toBe("TRUE");
  });

  it("not: inverts TRUE to FALSE", () => {
    const node: RuleNode = {
      id: "root", type: "not", children: [
        { id: "c1", type: "eq", fact: "applicant.is_employed", value: true, explain: { en: "Employed" } },
      ],
    };
    const facts = [makeFact("applicant.is_employed", true)];
    expect(evaluateNode(node, facts, EVAL_DATE).outcome).toBe("FALSE");
  });

  it("not: inverts FALSE to TRUE", () => {
    const node: RuleNode = {
      id: "root", type: "not", children: [
        { id: "c1", type: "eq", fact: "applicant.is_employed", value: true, explain: { en: "Employed" } },
      ],
    };
    const facts = [makeFact("applicant.is_employed", false)];
    expect(evaluateNode(node, facts, EVAL_DATE).outcome).toBe("TRUE");
  });

  it("not: preserves UNKNOWN", () => {
    const node: RuleNode = {
      id: "root", type: "not", children: [
        { id: "c1", type: "eq", fact: "applicant.is_employed", value: true, explain: { en: "Employed" } },
      ],
    };
    expect(evaluateNode(node, [], EVAL_DATE).outcome).toBe("UNKNOWN");
  });

  it("evaluates all children even if parent decided (no short-circuit)", () => {
    const node: RuleNode = {
      id: "root", type: "all", children: [
        { id: "c1", type: "eq", fact: "applicant.is_student", value: true, explain: { en: "Student" } },
        { id: "c2", type: "eq", fact: "applicant.is_bpl", value: true, explain: { en: "BPL" } },
      ],
    };
    const facts = [makeFact("applicant.is_student", false), makeFact("applicant.is_bpl", false)];
    const result = evaluateNode(node, facts, EVAL_DATE);
    // Both children should be evaluated (trace has 2 children)
    expect(result.trace.children?.length).toBe(2);
  });
});

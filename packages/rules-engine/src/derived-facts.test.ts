import { describe, it, expect } from "vitest";
import { ageOn, annualIncome, academicYear } from "./derived-facts.js";

describe("derived-facts", () => {
  describe("ageOn", () => {
    it("computes age correctly", () => {
      expect(ageOn("1990-03-15", "2025-06-15")).toBe(35);
    });

    it("handles birthday not yet passed", () => {
      expect(ageOn("1990-08-20", "2025-06-15")).toBe(34);
    });

    it("handles exact birthday", () => {
      expect(ageOn("1990-06-15", "2025-06-15")).toBe(35);
    });

    it("handles leap year birthday", () => {
      expect(ageOn("2000-02-29", "2025-02-28")).toBe(24);
      expect(ageOn("2000-02-29", "2025-03-01")).toBe(25);
    });
  });

  describe("annualIncome", () => {
    it("monthly to annual", () => {
      expect(annualIncome(10000, "monthly")).toBe(120000);
    });

    it("annual stays same", () => {
      expect(annualIncome(120000, "annual")).toBe(120000);
    });

    it("daily to annual", () => {
      expect(annualIncome(500, "daily")).toBe(182500);
    });
  });

  describe("academicYear", () => {
    it("returns correct academic year after June", () => {
      expect(academicYear("2025-07-15")).toBe("2025-26");
    });

    it("returns correct academic year before June", () => {
      expect(academicYear("2025-03-15")).toBe("2024-25");
    });

    it("handles June boundary (start month)", () => {
      expect(academicYear("2025-06-01")).toBe("2025-26");
    });
  });
});

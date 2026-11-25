import { describe, it, expect } from "vitest";
import { getTranslations } from "./i18n.js";

describe("web i18n", () => {
  it("provides complete English and Hindi dictionaries without empty keys", () => {
    const en = getTranslations("en");
    const hi = getTranslations("hi");
    const enKeys = Object.keys(en) as Array<keyof typeof en>;
    expect(enKeys.length).toBeGreaterThan(10);
    for (const k of enKeys) {
      expect(en[k].trim().length).toBeGreaterThan(0);
      expect(hi[k].trim().length).toBeGreaterThan(0);
    }
  });
});

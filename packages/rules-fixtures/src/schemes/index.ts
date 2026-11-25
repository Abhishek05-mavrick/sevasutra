import type { SchemeRuleVersion } from "rules-schema";
import { pmKisanScheme } from "./pm-kisan.js";
import { pmUjjwalaScheme } from "./pm-ujjwala.js";
import { postMatricScholarshipSCST } from "./post-matric-scholarship-sc-st.js";
import { pmAwasYojanaGramin } from "./pm-awas-yojana-gramin.js";
import { ayushmanBharat } from "./ayushman-bharat.js";

export const SEED_SCHEMES: readonly SchemeRuleVersion[] = [
  pmKisanScheme,
  pmUjjwalaScheme,
  postMatricScholarshipSCST,
  pmAwasYojanaGramin,
  ayushmanBharat,
];

# Known Limitations

## Sahayak — Phase 4: Deterministic Eligibility Engine

### 1. Seed Schemes Not Verified

All 5 seed schemes are based on publicly known Indian government programmes, but **none have been verified against official PDFs or notifications**. Every seed is marked `curator_status: "needs_human_verification"`. Amounts, income thresholds, eligibility criteria, and application deadlines should be confirmed by a human curator before any real-world use.

### 2. Simplified Eligibility Criteria

Real government schemes often have complex, multi-layered criteria involving:
- State-specific variations
- Multiple exclusion categories (e.g., PM-KISAN excludes former MLAs, taxpayers, etc.)
- SECC-2011 deprivation indicators (not modelled as simple BPL)
- Multiple benefit tiers based on category, region, institution type

The seed rules are intentionally simplified to demonstrate the engine's capabilities. Expanding them requires the official scheme guidelines.

### 3. Only 5 of 20 Target Seed Schemes

The plan calls for 20 curated schemes. Currently 5 are implemented:
1. PM-KISAN
2. PM Ujjwala Yojana
3. Post-Matric Scholarship for SC/ST
4. PMAY-Gramin
5. Ayushman Bharat (AB-PMJAY)

The remaining 15 (pension, disability, state-specific, corporate/CSR) are planned for subsequent iterations.

### 4. No External Integrations

The engine has no connections to:
- myScheme API
- National Scholarship Portal
- DigiLocker
- UIDAI Aadhaar
- API Setu

Only interfaces are defined; mocks are not yet implemented.

### 5. No Persistence Layer

The engine library is pure (no I/O). The API wrapper (`engine-api`) does not yet include Postgres/JSONB persistence or DB migrations. Evaluations are computed on-the-fly and not stored.

### 6. Limited Document Validation

Document checks are boolean (present/not present). The engine does not:
- Validate document expiry dates
- Cross-reference document types
- Check document authenticity

### 7. No Hindi Explanation Templates

While the schema supports `hi` (Hindi) explanations, many leaf nodes have incomplete or missing Hindi text. This needs a translation pass by a Hindi-speaking curator.

### 8. Single-Fact What-If Only

The "what would change" analysis only considers single-fact changes. It does not explore combinations of changes that could together flip the result.

### 9. No `diffRuleVersions` or `impactAnalysis`

The plan specifies `diffRuleVersions(a, b)` and `impactAnalysis(newVersion, storedProfiles)`. These require persistent storage and are deferred to the API layer implementation.

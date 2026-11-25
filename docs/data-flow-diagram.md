# Data Flow Diagram — Sahayak (PS 26)

## End-to-End Trust Boundaries & Data Flows

```mermaid
flowchart TD
    Citizen["Citizen Browser (Explorer / Verified Applicant)"]
    Admin["Curator / Support Operator Browser (MFA)"]

    subgraph Edge["API Gateway / Edge (TLS, Rate Limit, Zod Validation, Security Headers)"]
        API["engine-api (Fastify)"]
    end

    subgraph IdentityStore["Identity & Consent Store (Postgres)"]
        Users["users / identities / sessions"]
        Consents["consents / otp_challenges"]
        Audit["audit_events (PII-redacted)"]
    end

    subgraph ProfileVault["Profile & Document Boundary"]
        ProfileDB["profiles / profile_facts (provenance + expiry)"]
        ObjStore["Encrypted Object Storage (Signed URLs only)"]
        OCR["Pluggable OCR Adapter (Suggestions -> User Confirm)"]
    end

    subgraph KnowledgeEngine["Deterministic Core"]
        SchemeDB["schemes / scheme_versions / eligibility_rules"]
        Engine["packages/rules-engine (Pure, No I/O, No LLM)"]
        EvalDB["evaluations (Immutable Input Hash + Result)"]
    end

    subgraph AIandComms["AI Explanation & Communications"]
        Chat["RAG Chatbot (Approved Versioned Sources Only)"]
        LLM["Pluggable LLM Provider (Explain/Translate Only)"]
        Queue["Reminder Queue (Dedup + Quiet Hours)"]
        Mailer["Pluggable Email / DLT SMS Adapter"]
    end

    subgraph External["External Portals & Authorised APIs"]
        OfficialPortal["Official Scheme Portal (New Tab Redirect)"]
        GovAPIs["API Setu / DigiLocker / myScheme (Partner Approval Required)"]
        GoogleOIDC["Google OIDC (Explorer Sign-In Only)"]
    end

    Citizen -->|"HTTPS + Consent"| API
    Admin -->|"HTTPS + MFA"| API

    API -->|"Phone OTP / Session"| Users
    API -->|"Google OIDC Verify"| GoogleOIDC
    API -->|"Purpose Consent Check"| Consents
    API -->|"Redacted Events"| Audit

    API -->|"Confirmed Facts"| ProfileDB
    API -->|"Encrypted Upload / Short-lived Signed URL"| ObjStore
    ObjStore -->|"Optional Extract"| OCR
    OCR -->|"Suggested Facts (Unconfirmed)"| Citizen

    API -->|"Facts + RuleVersion + as_of"| Engine
    SchemeDB -->|"Immutable RuleVersion"| Engine
    Engine -->|"Deterministic EvaluationResult"| EvalDB

    Citizen -->|"Question"| Chat
    Chat -->|"Am I eligible?"| Engine
    Chat -->|"Retrieve Approved Docs"| SchemeDB
    Chat -->|"Explain Only (Sanitised)"| LLM

    EvalDB -->|"Deadline / Missing Info Events"| Queue
    Consents -->|"Opt-in Check"| Queue
    Queue -->|"No PII in Subject"| Mailer

    Citizen -->|"Checklist + Redirect"| OfficialPortal
    API -->|"Consented Mapping + Idempotency Key (if approved)"| GovAPIs
```

## Key Invariants
1. **`packages/rules-engine` is air-gapped from I/O, network, clocks, and LLMs.**
2. **Identity, profile facts, documents, and audit logs live in separated logical stores/schemas.**
3. **No raw Aadhaar numbers, OTPs, tokens, or bank account numbers are logged or included in email subjects.**
4. **Documents have no public URLs — access requires server-side authorisation and short-lived signed URLs.**

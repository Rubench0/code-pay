# Hackathon constraints

Rules from hackatonmexico.com/reglas that shape the product. Section numbers in brackets.

## Must
- Generate a real CoDi charge (QR, push or payment link) through the Pey API and react to its result via webhook [6.2]. Simulated or decorative integrations do not count.
- Run against Pey production [6.3]. There is no sandbox; test with $0.01.
- Build the CoDi/Pey integration during the hackathon [6.5, 9.7]. Repo history is the proof; organizers may ask for it [9.8].
- Public demo reachable without invitation, with test credentials if there is a login [10.1].
- Keep demo and video working until results are announced [10.3, 10.5].

## Must not
- Resell API access, expose it as a service to third parties, or build infrastructure that competes with the API for generating CoDi charges [7.4]. A merchant's own POS is explicitly allowed.
- Charge in favor of accounts not owned by the credential holder [7.3c].
- Collect on behalf of third parties or pool other businesses' payments [7.1].
- Pharmacy vertical (needs written authorization from Pey) [7.1].
- Load or stress tests against the API [8.3].
- Share credentials outside the team or reuse them in another project [8.1].

## Implications for this codebase
- One merchant and one CLABE (the credential holder's) for the hackathon.
- Every payment, tips included, goes directly from the payer's bank to that CLABE.
- No public endpoint lets arbitrary callers create charges for arbitrary merchants.
- Real money is our responsibility [6.4]: cap demo amounts, handle refunds manually.
- AI-generated code is allowed and needs no declaration [9.3]. Prior components must be declared [9.2]; this repo has none.

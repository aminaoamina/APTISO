# AI evaluation — after-registers

Run 2026-10-19T09:10:48.364Z · prompts: wizard-suggest@4, improve-paragraph@1, companion-chat@3, document-review@1, evidence-analysis@1, next-actions@2, weekly-digest@1

## Assistant

| Metric | Value |
| --- | --- |
| Cases passed | 22/24 (facts 14/15, refusals 2/3, teaching 6/6) |
| Fact recall | 100% |
| Answers with a valid source (when required) | 94% |
| Correct refusals | 67% |
| Answers with an invented fact | 0 |
| Latency p50 / p95 | 4.6 s / 12.1 s |

| Case | Result | Recall | Source | Notes |
| --- | --- | --- | --- | --- |
| fact-backup-owner | pass | 100% | yes |  |
| fact-gitlab-owner | pass | 100% | yes |  |
| fact-backup-deadline | pass | 100% | yes |  |
| fact-planned-controls | pass | 100% | yes |  |
| fact-pentest | pass | 100% | yes |  |
| fact-audit-conclusion | pass | 100% | yes |  |
| fact-open-nc | pass | 100% | yes |  |
| fact-review-date | FAIL | 100% | no |  |
| fact-scope-exclusions | pass | 100% | yes |  |
| fact-legal-gaps | pass | 100% | yes |  |
| fact-progress | pass | 100% | yes |  |
| fact-policy-approver | pass | 100% | yes |  |
| fact-acceptance | pass | 100% | yes |  |
| fact-incidents | pass | 100% | yes |  |
| fact-support-training | pass | 100% | yes |  |
| refuse-revenue | pass | 100% | no |  |
| refuse-firewall | pass | 100% | no |  |
| refuse-siem | FAIL | 100% | no |  |
| teach-soa | pass | 100% | yes |  |
| teach-9-2 | pass | 100% | yes |  |
| teach-a-8-13 | pass | 100% | yes |  |
| teach-nc-vs-obs | pass | 100% | yes |  |
| teach-6-1-2 | pass | 100% | yes |  |
| teach-2013-trap | pass | 100% | yes |  |

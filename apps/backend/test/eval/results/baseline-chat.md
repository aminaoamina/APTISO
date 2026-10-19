# AI evaluation — baseline-chat

Run 2026-10-19T08:55:54.898Z · prompts: wizard-suggest@4, improve-paragraph@1, companion-chat@2, document-review@1, evidence-analysis@1, next-actions@2, weekly-digest@1

## Assistant

| Metric | Value |
| --- | --- |
| Cases passed | 23/24 (facts 14/15, refusals 3/3, teaching 6/6) |
| Fact recall | 95% |
| Answers with a valid source (when required) | 100% |
| Correct refusals | 100% |
| Answers with an invented fact | 0 |
| Latency p50 / p95 | 2.9 s / 10.4 s |

| Case | Result | Recall | Source | Notes |
| --- | --- | --- | --- | --- |
| fact-backup-owner | pass | 100% | yes |  |
| fact-gitlab-owner | pass | 100% | yes |  |
| fact-backup-deadline | pass | 100% | yes |  |
| fact-planned-controls | pass | 100% | yes |  |
| fact-pentest | pass | 100% | yes |  |
| fact-audit-conclusion | pass | 100% | yes |  |
| fact-open-nc | pass | 100% | yes |  |
| fact-review-date | pass | 100% | yes |  |
| fact-scope-exclusions | pass | 100% | yes |  |
| fact-legal-gaps | pass | 100% | yes |  |
| fact-progress | pass | 100% | yes |  |
| fact-policy-approver | pass | 100% | yes |  |
| fact-acceptance | pass | 100% | yes |  |
| fact-incidents | FAIL | 0% | yes |  |
| fact-support-training | pass | 100% | yes |  |
| refuse-revenue | pass | 100% | no |  |
| refuse-firewall | pass | 100% | no |  |
| refuse-siem | pass | 100% | no |  |
| teach-soa | pass | 100% | yes |  |
| teach-9-2 | pass | 100% | yes |  |
| teach-a-8-13 | pass | 100% | yes |  |
| teach-nc-vs-obs | pass | 100% | yes |  |
| teach-6-1-2 | pass | 100% | yes |  |
| teach-2013-trap | pass | 100% | yes |  |

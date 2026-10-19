# AI evaluation — baseline-review2

Run 2026-10-19T08:58:23.359Z · prompts: wizard-suggest@4, improve-paragraph@1, companion-chat@2, document-review@1, evidence-analysis@1, next-actions@2, weekly-digest@1

## Document review

| Metric | Value |
| --- | --- |
| Documents passed | 4/4 |
| Planted defects found (recall) | 100% |
| Findings that match a planted defect (precision) | 73% |
| High-severity false alarms on the clean document | 0 |

| Document | Result | Defects found | Findings | Missed |
| --- | --- | --- | --- | --- |
| backup-policy | pass | 3/3 | 3 |  |
| access-control-policy | pass | 3/3 | 3 |  |
| incident-procedure | pass | 2/2 | 5 |  |
| clean-transfer-policy | pass | 0/0 | 0 |  |

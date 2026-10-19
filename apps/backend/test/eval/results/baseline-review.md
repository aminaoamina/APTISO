# AI evaluation — baseline-review

Run 2026-10-19T08:56:16.866Z · prompts: wizard-suggest@4, improve-paragraph@1, companion-chat@2, document-review@1, evidence-analysis@1, next-actions@2, weekly-digest@1

## Document review

| Metric | Value |
| --- | --- |
| Documents passed | 3/4 |
| Planted defects found (recall) | 100% |
| Findings that match a planted defect (precision) | 69% |
| High-severity false alarms on the clean document | 1 |

| Document | Result | Defects found | Findings | Missed |
| --- | --- | --- | --- | --- |
| backup-policy | pass | 3/3 | 6 |  |
| access-control-policy | pass | 3/3 | 4 |  |
| incident-procedure | pass | 2/2 | 6 |  |
| clean-transfer-policy | FAIL | 0/0 | 1 |  |

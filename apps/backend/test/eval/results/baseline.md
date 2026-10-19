# AI evaluation — baseline

Run 2026-10-19T08:45:51.412Z · prompts: wizard-suggest@4, improve-paragraph@1, companion-chat@2, document-review@1, evidence-analysis@1, next-actions@2, weekly-digest@1

## Assistant

| Metric | Value |
| --- | --- |
| Cases passed | 21/24 (facts 12/15, refusals 3/3, teaching 6/6) |
| Fact recall | 90% |
| Answers with a valid source (when required) | 100% |
| Correct refusals | 100% |
| Answers with an invented fact | 0 |
| Latency p50 / p95 | 4.5 s / 9.2 s |

| Case | Result | Recall | Source | Notes |
| --- | --- | --- | --- | --- |
| fact-backup-owner | pass | 100% | yes |  |
| fact-gitlab-owner | pass | 100% | yes |  |
| fact-backup-deadline | pass | 100% | yes |  |
| fact-planned-controls | pass | 100% | yes |  |
| fact-pentest | FAIL | 50% | yes |  |
| fact-audit-conclusion | pass | 100% | yes |  |
| fact-open-nc | pass | 100% | yes |  |
| fact-review-date | FAIL | 50% | yes |  |
| fact-scope-exclusions | pass | 100% | yes |  |
| fact-legal-gaps | pass | 100% | yes |  |
| fact-progress | pass | 100% | yes |  |
| fact-policy-approver | pass | 100% | yes |  |
| fact-acceptance | pass | 100% | yes |  |
| fact-incidents | FAIL | 0% | yes |  |
| fact-support-training | pass | 100% | yes |  |
| refuse-revenue | pass | 100% | no |  |
| refuse-firewall | pass | 100% | yes |  |
| refuse-siem | pass | 100% | no |  |
| teach-soa | pass | 100% | yes |  |
| teach-9-2 | pass | 100% | yes |  |
| teach-a-8-13 | pass | 100% | yes |  |
| teach-nc-vs-obs | pass | 100% | yes |  |
| teach-6-1-2 | pass | 100% | yes |  |
| teach-2013-trap | pass | 100% | yes |  |

## Document review

| Metric | Value |
| --- | --- |
| Documents passed | 0/4 |
| Planted defects found (recall) | 0% |
| Findings that match a planted defect (precision) | 0% |
| High-severity false alarms on the clean document | 0 |

| Document | Result | Defects found | Findings | Missed |
| --- | --- | --- | --- | --- |
| backup-policy | FAIL | 0/3 | 0 | vague-regularly, missing-restore-test, contradiction-same-server |
| access-control-policy | FAIL | 0/3 | 0 | shared-admin, vague-review, missing-removal |
| incident-procedure | FAIL | 0/2 | 0 | vague-promptly, missing-lessons |
| clean-transfer-policy | FAIL | 0/0 | 0 |  |

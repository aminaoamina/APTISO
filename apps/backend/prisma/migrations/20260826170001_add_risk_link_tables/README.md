# ⚠️ Do not run `seed_controls.sql`

`seed_controls.sql` in this folder was **never executed** by Prisma — only
`migration.sql` runs — and it is **incorrect**. Do not run it manually.

It contains 102 rows, but ISO/IEC 27001:2022 Annex A defines **93** controls:

| Group | In `seed_controls.sql` | ISO 27001:2022 | Verdict |
|---|---|---|---|
| A.5 Organizational | 37 | 37 | correct |
| A.6 People | 6 | 8 | **wrong count and wrong content** |
| A.7 Physical | 14 | 14 | correct |
| A.8 Technological | 34 | 34 | correct |
| A.9, A.17 | 11 | — | **do not exist in the 2022 revision** |

Its A.6 rows hold risk-clause text rather than People controls:

```
'A.6.1', 'Information security risk assessment'     <- not a People control
'A.6.2', 'Information security risk treatment'      <- not a People control
```

ISO 27001:2022 A.6 is *People controls* — Screening, Terms and conditions of
employment, Disciplinary process, and so on. The `A.9.*` and `A.17.*` titles
were fabricated and belong to no revision of the standard.

## Use this instead

The correct catalogue is seeded by:

```
20260826180000_seed_annex_a_controls/migration.sql
```

It reuses the verified A.5 / A.7 / A.8 entries from `seed_controls.sql` and
supplies the eight real A.6 People controls. It is idempotent
(`ON CONFLICT ... DO UPDATE`) and safe to re-run.

`seed_controls.sql` is kept only as the provenance of those 85 verified rows.

from app.prompts import Prompt

WIZARD_SUGGEST = Prompt(
    "wizard-suggest",
    4,
    """You help a person fill in one question of a document wizard. The answer becomes part of an ISO/IEC 27001 document of their organization, so every statement must be true for that organization.
- Use only facts written in the <data> items. For each fact you use, add an entry to "support" with the data id and a short quote copied word for word from that item.
- Never add details the data does not state: no cloud providers, software, products, locations, departments, devices, numbers or dates unless they appear in the data. Plausible is not enough.
- A quote supports a statement only if it says that fact itself. A quote about something else (for example the company's activity) does not support a statement about its departments, processes or exclusions.
- The question's help text explains what is asked. Its examples are not facts about this organization, and a rule in it (such as "for companies smaller than 50 employees, write ...") applies only if the data shows its condition is true.
- Decisions the organization must take (what is in or out of scope, who is responsible, what is excluded) are never assumed. If the data does not state them, leave the answer empty and report them as missing.
- Write the answer ready to insert in the document, in the organization's own terms, without placeholders such as [Company] or "TBD". Keep it short: a few words or a short list for a short field, a few sentences at most for a long field.
- If the data does not contain what the question asks, return an empty "answer" and list in "missing" exactly what information is needed (for example "the list of departments of the organization"). A partial answer is fine if every part is supported.""",
)

IMPROVE_PARAGRAPH = Prompt(
    "improve-paragraph",
    1,
    """You rewrite a passage of an ISO/IEC 27001 document following the person's instruction.
- Keep every fact: names, roles, numbers, dates, frequencies, durations, control and clause IDs. Do not add new facts, commitments, frequencies or deadlines.
- Change only the wording and structure. Use clear, formal language suitable for a management system document.
- Return only the rewritten passage as plain text: no title, no explanations, no quotation marks around it.""",
)

IMPROVE_INSTRUCTIONS = {
    "clearer": "Make it clearer and easier to understand.",
    "formal": "Make it more formal and precise.",
    "shorter": "Make it shorter without losing any fact.",
}

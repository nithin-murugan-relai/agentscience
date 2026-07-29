"""Init smoke validation environment for the AgentScience simulator.

Reconstructed per SDK_REFERENCE.md "Init Smoke Validation" from the recorded
relai-init-smoke transcript: one representative, project-valid fixed turn that
exercises the generated adapter without modifying files or hitting the network.
"""

import relai

environment = relai.RELAIEnvironment(
    id="relai-init-smoke",
    name="relai-init-smoke",
    description=(
        "Smoke-check the AgentScience simulator adapter with one read-only "
        "repo-inspection turn."
    ),
    input=relai.FixedInput(
        turns=[
            relai.FixedTurn(
                content=(
                    "Read README.md and reply with the names of the two main "
                    "packages where most engineering work in this repo happens. "
                    "Do not modify any files or run networked commands."
                )
            )
        ]
    ),
    evaluators=[],
)

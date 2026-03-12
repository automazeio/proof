# Agent Skills

Agent Skills for `@automaze/proof`, following the open [Agent Skills](https://agentskills.io) specification.

## Available Skills

| Skill | Description |
|-------|-------------|
| [`proof`](proof/) | Capture visual evidence of test execution -- terminal replays, browser videos, and structured reports |

> [!TIP]
> **Quick start for any AI agent:** Point your agent to `https://github.com/automazeio/proof/tree/main/skills/proof/SKILL.md` and tell it to install and use the skill.

## What Are Agent Skills?

Agent Skills are folders of instructions, scripts, and resources that AI agents can discover and use. They work with any compatible agent tool, including Claude Code, Cursor, GitHub Copilot, VS Code, Factory, Amp, Goose, and many others.

Skills use a progressive disclosure model:
1. **Metadata** (~100 tokens) -- name and description, loaded at startup
2. **Instructions** (< 500 lines) -- full `SKILL.md` body, loaded when activated
3. **References** (on demand) -- detailed docs in `references/`, loaded as needed

## Installation

### Claude Code

```bash
claude mcp add-skill skills/proof
```

Or add to your `.claude/settings.json`:
```json
{
  "skills": ["skills/proof"]
}
```

### Cursor

Add to `.cursor/skills/` by copying or symlinking:
```bash
ln -s $(pwd)/skills/proof .cursor/skills/proof
```

### Generic (any compatible agent)

Point your agent's skill discovery directory at `skills/proof/`. The agent will parse the `SKILL.md` frontmatter at startup and activate the full skill when proof-related tasks come up.

For filesystem-based agents, the skill is activated when the agent reads `skills/proof/SKILL.md`. Reference files in `skills/proof/references/` are loaded on demand.

### Manual / Custom Integration

Parse the YAML frontmatter from `SKILL.md` and inject into your agent's system prompt:

```xml
<available_skills>
  <skill>
    <name>proof</name>
    <description>Capture visual evidence of test execution using @automaze/proof. Records terminal output and browser interactions as shareable artifacts.</description>
    <location>/path/to/skills/proof/SKILL.md</location>
  </skill>
</available_skills>
```

When the skill is activated, load the full `SKILL.md` body. For detailed reference, the agent can read files from `references/`:

```
skills/proof/
├── SKILL.md                    # Main instructions (~243 lines)
└── references/
    ├── typescript.md           # Full TypeScript SDK guide
    └── cli.md                  # Full CLI guide
```

## Validation

Validate the skill using the [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref) CLI:

```bash
skills-ref validate skills/proof
```

## Learn More

- [Agent Skills Specification](https://agentskills.io/specification) -- the full format spec
- [Agent Skills GitHub](https://github.com/agentskills/agentskills) -- reference implementation

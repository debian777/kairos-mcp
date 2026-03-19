# Business application cases

<img src="../../logo/kaiiros-mcp.svg" width="96" alt="KAIROS MCP logo" />

This section describes **real-world applications** of KAIROS for managers and
decision-makers. Each case is a short example of how teams use automated
workflows to standardize processes, speed up compliance, or keep codebases
consistent—without going into technical protocol details.

## What these cases show

- **Repeatable procedures:** The same workflow runs the same way every time,
  so outcomes are predictable.
- **Speed:** From a new requirement (e.g. a compliance document) to a first
  result in minutes.
- **Consistency:** Team practices (commits, merge requests, Terraform style)
  are enforced by a shared procedure instead of ad-hoc chat.

```mermaid
flowchart LR
  subgraph in["Inputs"]
    A([New standard])
    B([Team policy])
    C([Legacy modules])
  end
  subgraph kairos["KAIROS workflow"]
    D[Run procedure]
  end
  subgraph out["Outcomes"]
    E[Compliance report]
    F[Consistent MRs]
    G[Standardized code]
  end
  A --> D --> E
  B --> D --> F
  C --> D --> G
  style A fill:#4a6fa5,stroke:#2d4a7a,color:#fff
  style B fill:#4a6fa5,stroke:#2d4a7a,color:#fff
  style C fill:#4a6fa5,stroke:#2d4a7a,color:#fff
  style D fill:#ffb74d,stroke:#f57c00,color:#333
  style E fill:#81c784,stroke:#388e3c,color:#333
  style F fill:#81c784,stroke:#388e3c,color:#333
  style G fill:#81c784,stroke:#388e3c,color:#333
```

## Cases

| Case | Problem | Outcome |
|------|--------|--------|
| [Standardize commits and merge requests](case-standardize-commits-and-merge-requests.md) | Align the team on commit messages and MR rules | One shared procedure; everyone follows the same steps when creating merge requests |
| [Compliance review from a new document (15 minutes)](case-compliance-review-from-pdf.md) | Check a codebase against a new compliance standard (e.g. NIST) | New procedure created from the PDF; first compliance report against the repo in about 15 minutes |
| [Terraform module standardization](case-terraform-module-standardization.md) | Keep Terraform modules consistent and up to date | Standardize-project style workflow applied to Terraform; updated, consistent modules |

## Who this is for

| Audience | Interest |
|----------|----------|
| Engineering and platform leads | Automate team workflows and reduce drift |
| Compliance and risk | Fast, repeatable checks against standards |
| Product and delivery | Agents that follow a playbook instead of one-off chat |

## More information

For technical details on how protocols run, see [Architecture and protocol
workflows](../architecture/README.md).

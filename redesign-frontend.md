# Redesign do Frontend: Estilo Brutalista e Alta Performance

## 🎨 DESIGN COMMITMENT (ANTI-SAFE HARBOR)
- **Selected Radical Style**: Typographic Brutalism / Extreme Asymmetry
- **Why this style?** -> Telecom traffic data is serious and high-stakes. We avoid the "safe" soft SaaS look to make the platform feel like an advanced, high-performance tactical dashboard.
- **Risk Factor**: 0px to 2px border radius, sharp raw borders, asymmetrical 80/20 split on login, acid color accents on absolute black.
- **Modern Cliché Scan**: No soft bento grids. No glassmorphism blur. No mesh gradients. No teal/cyan default. No purple.
- **Palette**: 
  - Background: Absolute Black (`#06080A`)
  - Primary Accent: Acid Green (`#BAFF29`)
  - Error/Alert: Crimson Red (`#FF2E4C`)
  - Text: Pure White (`#FFFFFF`) and Ash Gray (`#8A949C`)
  - Borders: Raw 1px solid (`rgba(255,255,255,0.1)`)

## Implementação
1. **`login.html`**: Redesenho completo do CSS in-line. Remover "orbs" e "glassmorphism". Adicionar tipografia massiva e assimetria.
2. **`css/styles.css`**: Alterar variáveis globais, remover border-radius de 16px/12px, remover bordas gradientes e soft shadows. Adicionar linhas duras e animações secas.

## Checklist do Maestro
- [ ] O split seguro de 50/50 foi quebrado?
- [ ] O glassmorphism (backdrop-blur) foi removido em favor de bordas cruas?
- [ ] A cor roxa foi evitada?
- [ ] Os botões têm bordas afiadas?

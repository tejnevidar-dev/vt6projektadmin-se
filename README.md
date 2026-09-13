# admin.vt6

Jag ska just nu bygga en säljpanel för min takfirma. Det är en sälj panel för kalla och varma kunder inom fältsälj och telemarketing. Jag ska kunna mata in nummer och adresser och jag vill integrera ett system som vi ska bygga. Ett system där du kan scanna av alla byggnader i ett helt område och sedan filtrera fram alla byggnader med ett byggnadsår som är äldre än vad livsländen är på ett tak. Då ska du kunna ge helt direkt information på fastigheten. Exempelvis: Jag filtrerar in område/län/kommun. filtrerar in byggnadsår eftersom att vi även gör taktvättar vill jag också kunna filtrera in byggnadsår. Så jag väljer tillexempel roslagen, sen väljer jag hus som är byggda för mer än 40 år sedan och om du kan ska du även kunna sortera efter om du ser att det har ansökts om något bygglov på något som gäller taket. Sen när du filtrerat fram alla adresser i ett helt område så ska du med hjälp av bla ratsit.se ta fram ett telefonnummer på varje adress samt ett namn på person och ålder. Detta är bara en skiss ås vi börjar att bygga utefter skissen sen får vi finslipa och utveckla

## Development

Package manager is [bun](https://bun.sh).

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
```

See [CLAUDE.md](./CLAUDE.md) for architecture notes and [docs/lovable-exit-plan.md](./docs/lovable-exit-plan.md) for the project's migration history off Lovable.

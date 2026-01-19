
# Project Documentation

## 1. Git Workflow & Conventions

### Creating a Branch
```bash
git checkout master
git pull origin master
git checkout -b feature/my-feature-name
```

### Rebasing Your Branch
```bash
git fetch origin
git rebase origin/master
```

### Commit Message Convention

- **fix:** fixing a bug
- **chore:** maintenance or updates
- **feat:** adding a new feature

Examples:
```bash
git commit -m "fix: resolve ticket availability issue"
git commit -m "chore: update dependencies"
git commit -m "feat: add payment confirmation flow"
```

### Pull Requests
- One pull request per feature
- No direct pushes to master
- Clear description and purpose

---

## 2. Backend Architecture (NestJS)

### Overview
The backend is built using NestJS with a modular architecture and MongoDB using Mongoose.

### Project Structure
```
src/
├── common/
├── config/
├── modules/
│   ├── users/
│   ├── events/
│   ├── tickets/
│   └── payments/
├── database/
└── main.ts
```

### Layered Flow
Controller → Service → Repository → Database

---

## 3. NestJS CLI Commands

### Generate Module
```bash
nest g module modules/example
```

### Generate Controller
```bash
nest g controller modules/example
```

### Generate Service
```bash
nest g service modules/example
```

### Mongoose Schema Example
```ts
@Schema()
export class Example {
  @Prop()
  name: string;
}
```

---

## 4. Project Overview & UML

### Entities
- User
- Event
- Ticket
- Payment

### Relationships
```
User 1 ── * Ticket
Event 1 ── * Ticket
Ticket 1 ── 1 Payment
User 1 ── * Payment
```

### Business Rules
- Tickets cannot be oversold
- Payments are transactional
- Ownership is finalized after payment confirmation

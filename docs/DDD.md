# Domain-Driven Design (DDD) - Guia de Estudo

Este documento explica os conceitos de **Domain-Driven Design** aplicados neste projeto, um fórum de perguntas e respostas construído com NestJS e TypeScript.

---

## O que é DDD?

Domain-Driven Design é uma abordagem de desenvolvimento de software que coloca o **domínio do negócio** no centro de todas as decisões de arquitetura. Em vez de pensar primeiro em banco de dados, frameworks ou APIs, você modela o software a partir das regras e processos reais do negócio.

A ideia central é: **o código deve refletir a linguagem e a estrutura do negócio**.

---

## Estrutura de Pastas

```
src/
├── core/                          # Blocos fundamentais reutilizáveis (independente de domínio)
│   ├── entities/
│   │   ├── entity.ts              # Classe base de todas as entidades
│   │   ├── aggregate-root.ts      # Classe base para agregados
│   │   ├── unique-entity-id.ts    # Value Object de identidade
│   │   └── watched-list.ts        # Lista observável (tracked list)
│   ├── events/
│   │   ├── domain-event.ts        # Interface de evento de domínio
│   │   ├── domain-events.ts       # Dispatcher central de eventos
│   │   └── event-handler.ts       # Interface de handler de evento
│   ├── errors/
│   │   ├── use-case-error.ts      # Interface base de erros
│   │   └── errors/
│   │       ├── not-allowed-error.ts
│   │       └── resource-not-found-error.ts
│   ├── repositories/
│   │   └── pagination-params.ts   # Interface de paginação
│   └── types/
│       └── optional.ts            # Utility type
│
├── domain/
│   ├── forum/                     # Bounded Context: Fórum
│   │   ├── enterprise/            # Camada de domínio (regras de negócio puras)
│   │   │   ├── entities/          # Entidades e Value Objects
│   │   │   └── events/            # Eventos de domínio
│   │   └── application/           # Camada de aplicação (casos de uso)
│   │       ├── use-cases/         # Casos de uso (orquestram entidades)
│   │       └── repositories/      # Interfaces de repositório (contratos)
│   │
│   └── notification/              # Bounded Context: Notificações
│       ├── enterprise/
│       │   └── entities/
│       └── application/
│           ├── use-cases/
│           ├── repositories/
│           └── subscribers/       # Reagem a eventos de outros domínios
│
├── controllers/                   # Camada HTTP (NestJS)
├── prisma/                        # Infraestrutura de acesso a dados
│
test/
├── repositories/                  # Repositórios in-memory para testes
├── factories/                     # Factories para criação de objetos de teste
└── utils/
```

### Por que essa divisão?

**`core/`** — Contém as abstrações genéricas que qualquer domínio pode usar. `Entity`, `AggregateRoot`, `WatchedList`, `DomainEvents`... nada aqui sabe sobre fórum ou notificações. É o "framework" interno do DDD.

**`domain/`** — Cada subpasta é um **Bounded Context** (contexto delimitado). O fórum e as notificações são domínios separados com suas próprias regras. Eles se comunicam através de **eventos de domínio**, nunca referenciando diretamente as entidades um do outro.

**`enterprise/` vs `application/`** — Dentro de cada bounded context:

- **`enterprise/`** contém as **regras de negócio puras** (entidades, value objects, eventos). Esse código não depende de banco de dados, framework ou qualquer detalhe técnico.
- **`application/`** contém os **casos de uso** que orquestram as entidades e os **contratos de repositório** (interfaces). Essa camada sabe _o que_ precisa ser feito, mas não _como_ (a implementação concreta do repositório fica fora do domínio).

**`test/repositories/`** — Implementações in-memory dos repositórios. Permitem testar os casos de uso sem banco de dados real, de forma rápida e isolada.

---

## Entidades (Entities)

### O que são?

Entidades são objetos que possuem uma **identidade única** que persiste ao longo do tempo. Dois objetos com os mesmos atributos mas IDs diferentes são considerados **diferentes**. Dois objetos com atributos diferentes mas o mesmo ID são considerados **o mesmo**.

### Para que servem?

Representam os conceitos centrais do domínio que precisam ser rastreados individualmente. Uma `Question` é uma entidade porque cada pergunta é única — mesmo que duas tenham o mesmo título, são perguntas distintas.

### Como funciona no projeto?

A classe base `Entity<Props>` (`src/core/entities/entity.ts`):

```typescript
export abstract class Entity<Props> {
  private _id: UniqueEntityID
  protected props: Props

  protected constructor(props: Props, id?: UniqueEntityID) {
    this.props = props
    this._id = id ?? new UniqueEntityID() // Gera um UUID se não receber um
  }

  public equals(entity: Entity<unknown>) {
    if (entity === this) return true
    if (entity.id === this._id) return true
    return false
  }
}
```

Características importantes:

- **Identidade obrigatória**: toda entidade recebe um `UniqueEntityID` (UUID).
- **Igualdade por identidade**: o método `equals()` compara pelo ID, não pelos atributos.
- **Props protegidas**: os atributos ficam encapsulados em `props`, acessados via getters/setters que podem conter lógica de negócio.
- **Construtor protegido**: entidades são criadas via factory method estático `create()`, não via `new`.

### Exemplos no projeto

| Entidade             | Arquivo                                                   | Descrição                                |
| -------------------- | --------------------------------------------------------- | ---------------------------------------- |
| `Question`           | `domain/forum/enterprise/entities/question.ts`            | Pergunta do fórum (Aggregate Root)       |
| `Answer`             | `domain/forum/enterprise/entities/answer.ts`              | Resposta a uma pergunta (Aggregate Root) |
| `Comment`            | `domain/forum/enterprise/entities/comment.ts`             | Classe base abstrata para comentários    |
| `QuestionComment`    | `domain/forum/enterprise/entities/question-comment.ts`    | Comentário em uma pergunta               |
| `Student`            | `domain/forum/enterprise/entities/student.ts`             | Aluno                                    |
| `Instructor`         | `domain/forum/enterprise/entities/instructor.ts`          | Instrutor                                |
| `Notification`       | `domain/notification/enterprise/entities/notification.ts` | Notificação                              |
| `QuestionAttachment` | `domain/forum/enterprise/entities/question-attachment.ts` | Anexo de uma pergunta                    |

---

## Value Objects (Objetos de Valor)

### O que são?

Value Objects são objetos que **não possuem identidade**. Eles são definidos exclusivamente pelos seus **atributos**. Dois value objects com os mesmos valores são considerados **iguais e intercambiáveis**.

### Para que servem?

Encapsulam conceitos do domínio que são descritos por seus valores, não por uma identidade. Ao invés de usar tipos primitivos como `string` para tudo, você cria value objects que carregam **significado e validação**.

Por exemplo: um slug não é "qualquer string" — ele tem regras específicas de formatação. Ao criar um Value Object `Slug`, essas regras ficam encapsuladas em um só lugar.

### Como funciona no projeto?

**`Slug`** (`src/domain/forum/enterprise/entities/value-objects/slug.ts`):

```typescript
export class Slug {
  public value: string

  private constructor(value: string) {
    // Construtor privado!
    this.value = value
  }

  static create(value: string) {
    return new Slug(value)
  }

  static createFromText(text: string): Slug {
    const slugText = text
      .normalize('NFKD')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/_/g, '-')
      .replace(/--+/g, '-')
      .replace(/-$/g, '')

    return new Slug(slugText)
  }
}
```

O construtor é **privado** — você só cria via `Slug.create()` (valor direto) ou `Slug.createFromText()` (com normalização). Isso garante que todo Slug no sistema está no formato correto.

**`UniqueEntityID`** (`src/core/entities/unique-entity-id.ts`) — Também é um Value Object! Ele encapsula o conceito de identidade:

```typescript
export class UniqueEntityID {
  private value: string

  constructor(value?: string) {
    this.value = value ?? randomUUID()
  }

  public equals(id: UniqueEntityID) {
    return id.toValue() === this.value
  }
}
```

### Diferença entre Entidade e Value Object

| Característica  | Entidade                           | Value Object               |
| --------------- | ---------------------------------- | -------------------------- |
| Tem identidade? | Sim (ID único)                     | Não                        |
| Igualdade       | Comparada pelo ID                  | Comparada pelos atributos  |
| Mutável?        | Sim (pode mudar ao longo do tempo) | Preferencialmente imutável |
| Exemplo         | `Question`, `Answer`               | `Slug`, `UniqueEntityID`   |

Um bom teste: se dois objetos com os mesmos valores são "a mesma coisa", é um Value Object. Se precisam ser diferenciados mesmo com valores iguais, é uma Entidade.

---

## Aggregates (Agregados)

### O que são?

Um Aggregate é um **grupo de entidades e value objects** que são tratados como uma **unidade de consistência**. Todo aggregate tem uma **raiz** (Aggregate Root) que é o único ponto de acesso externo.

### Para que servem?

Garantem a **consistência das regras de negócio**. Você nunca modifica uma entidade filha diretamente — sempre passa pela raiz do agregado, que valida e coordena as mudanças.

Além disso, os aggregates são a **fronteira de transação**: ao salvar, você salva o agregado inteiro de uma vez.

### Como funciona no projeto?

A classe `AggregateRoot<Props>` (`src/core/entities/aggregate-root.ts`):

```typescript
export abstract class AggregateRoot<Props> extends Entity<Props> {
  private _domainEvents: DomainEvent[] = []

  get domainEvents(): DomainEvent[] {
    return this._domainEvents
  }

  protected addDomainEvent(domainEvent: DomainEvent): void {
    this._domainEvents.push(domainEvent)
    DomainEvents.markAggregateForDispatch(this)
  }

  public clearEvents() {
    this._domainEvents = []
  }
}
```

O `AggregateRoot` estende `Entity` e adiciona a capacidade de **acumular e despachar eventos de domínio**. Quando algo importante acontece dentro do agregado, ele registra um evento que será disparado depois (geralmente após a persistência).

### Exemplos no projeto

**`Question`** é um Aggregate Root:

- Contém `QuestionAttachmentList` (lista de anexos)
- Quando a `bestAnswerId` muda, dispara o evento `QuestionBestAnswerChosenEvent`
- Ao alterar `title`, automaticamente recalcula o `slug`

**`Answer`** é outro Aggregate Root:

- Contém `AnswerAttachmentList`
- Quando uma nova resposta é criada, dispara `AnswerCreatedEvent`

**`Student`**, **`Instructor`**, **`Comment`**, **`Notification`** são Entidades simples (não são Aggregate Roots) — não gerenciam sub-entidades nem disparam eventos.

### Visualização do Aggregate Question

```
Question (Aggregate Root)
├── title: string
├── content: string
├── slug: Slug (Value Object)
├── authorId: UniqueEntityID (Value Object)
├── bestAnswerId: UniqueEntityID (Value Object)
├── attachments: QuestionAttachmentList (Watched List)
│   ├── QuestionAttachment (Entidade)
│   ├── QuestionAttachment (Entidade)
│   └── ...
└── Domain Events: [QuestionBestAnswerChosenEvent, ...]
```

---

## Watched Lists (Listas Observáveis)

### O que são?

Uma Watched List é uma **lista que rastreia mudanças**. Ela sabe quais itens foram **adicionados**, **removidos** e quais são os **itens atuais**, comparando com o estado inicial.

### Para que servem?

Quando você edita uma pergunta e muda os anexos, o sistema precisa saber: quais anexos foram adicionados? Quais foram removidos? A Watched List resolve esse problema automaticamente.

Sem ela, ao salvar você teria que deletar todos os anexos e reinserir — ineficiente e propenso a erros. Com ela, o repositório faz apenas as operações necessárias (insere os novos, deleta os removidos).

### Como funciona no projeto?

A classe abstrata `WatchedList<T>` (`src/core/entities/watched-list.ts`) mantém três listas internas:

```
initial  → estado original (snapshot do carregamento)
current  → estado atual (depois das modificações)
new      → itens que foram adicionados (current - initial)
removed  → itens que foram removidos (initial - current)
```

Métodos principais:

- **`add(item)`** — Adiciona um item. Se estava na lista de removidos, tira de lá. Se é novo (não existia no initial), vai pra lista `new`.
- **`remove(item)`** — Remove um item. Se era novo, apenas tira da lista `new`. Se existia no initial, vai pra lista `removed`.
- **`update(items)`** — Recebe a lista completa e calcula automaticamente o que foi adicionado e removido.
- **`getNewItems()`** — Retorna os itens adicionados.
- **`getRemovedItems()`** — Retorna os itens removidos.

### Exemplo concreto

`QuestionAttachmentList` (`src/domain/forum/enterprise/entities/question-attachment-list.ts`):

```typescript
export class QuestionAttachmentList extends WatchedList<QuestionAttachment> {
  compareItems(a: QuestionAttachment, b: QuestionAttachment): boolean {
    return a.attachmentId.equals(b.attachmentId)
  }
}
```

A única coisa que a implementação concreta precisa definir é **como comparar dois itens** (via `compareItems`). O resto da lógica de tracking é herdado.

### Fluxo na prática

```
1. Carrega Question do banco com anexos [A, B, C]
   → WatchedList: initial=[A,B,C], current=[A,B,C], new=[], removed=[]

2. Remove anexo B, adiciona anexo D
   → WatchedList: initial=[A,B,C], current=[A,C,D], new=[D], removed=[B]

3. Repositório salva:
   → INSERT anexo D (getNewItems)
   → DELETE anexo B (getRemovedItems)
   → Não mexe em A e C (eficiente!)
```

---

## Domain Events (Eventos de Domínio)

### O que são?

Eventos de domínio representam **algo que aconteceu** no domínio que outros contextos podem ter interesse em saber. São fatos no passado: "uma resposta foi criada", "a melhor resposta foi escolhida".

### Para que servem?

Permitem **comunicação desacoplada** entre bounded contexts. O domínio de Fórum não precisa conhecer o domínio de Notificações — ele apenas dispara o evento "resposta criada" e quem quiser reagir, reage.

### Como funciona no projeto?

**1. Interface do evento** (`src/core/events/domain-event.ts`):

```typescript
export interface DomainEvent {
  ocurredAt: Date
  getAggregateId(): UniqueEntityID
}
```

**2. Evento concreto** (`src/domain/forum/enterprise/events/answer-created-event.ts`):

```typescript
export class AnswerCreatedEvent implements DomainEvent {
  public ocurredAt: Date
  public answer: Answer

  constructor(answer: Answer) {
    this.answer = answer
    this.ocurredAt = new Date()
  }

  getAggregateId(): UniqueEntityID {
    return this.answer.id
  }
}
```

**3. Disparado pelo Aggregate Root** — Quando uma nova `Answer` é criada:

```typescript
static create(props, id?) {
  const answer = new Answer({ ... }, id)
  const isNewAnswer = !id

  if (isNewAnswer) {
    answer.addDomainEvent(new AnswerCreatedEvent(answer))
  }

  return answer
}
```

**4. Subscriber reage** (`src/domain/notification/application/subscribers/on-answer-created.ts`):

```typescript
export class OnAnswerCreated implements EventHandler {
  setupSubscriptions(): void {
    DomainEvents.register(
      this.sendNewAnswerNotification.bind(this),
      AnswerCreatedEvent.name,
    )
  }

  private async sendNewAnswerNotification({ answer }: AnswerCreatedEvent) {
    const question = await this.questionsRepository.findById(
      answer.questionId.toString(),
    )

    if (question) {
      await this.sendNotification.execute({
        recipientId: question.authorId.toString(),
        title: `Nova resposta em "${question.title.substring(0, 40).concat('...')}"`,
        content: answer.excerpt,
      })
    }
  }
}
```

### Fluxo completo

```
Aluno responde pergunta
  → Answer.create() dispara AnswerCreatedEvent
    → DomainEvents.dispatch() encontra handlers registrados
      → OnAnswerCreated reage: busca a pergunta, envia notificação ao autor
```

O domínio de Fórum **não sabe** que notificações existem. Essa é a beleza dos eventos de domínio.

---

## Either Pattern (Tratamento de Erros Funcional)

### O que é?

O pattern `Either<L, R>` (`src/core/either.ts`) é uma alternativa ao `try/catch` para representar operações que podem falhar. Retorna `Left` para erro e `Right` para sucesso.

### Para que serve?

Torna os **erros explícitos no tipo de retorno**. O compilador te obriga a lidar com o caso de erro — diferente de exceções, que podem ser esquecidas.

```typescript
type CreateQuestionUseCaseResponse = Either<
  null, // Possível erro (Left)
  { question: Question } // Sucesso (Right)
>
```

Ao consumir:

```typescript
const result = await createQuestion.execute({ ... })

if (result.isLeft()) {
  // Tratar erro — result.value é do tipo de erro
}

if (result.isRight()) {
  // Usar result.value.question — sucesso!
}
```

Os erros do projeto implementam a interface `UseCaseError`:

- **`ResourceNotFoundError`** — recurso não encontrado
- **`NotAllowedError`** — ação não permitida (ex: deletar pergunta de outro autor)

---

## Repositórios (Repository Pattern)

### O que são?

Repositórios são **interfaces** que definem como as entidades são persistidas e recuperadas. No domínio, existem apenas os **contratos** — as implementações concretas (Prisma, in-memory, etc.) ficam fora.

### Para que servem?

Desacoplam o domínio da tecnologia de persistência. O caso de uso `CreateQuestionUseCase` recebe um `QuestionsRepository` (interface) — não importa se é Prisma, MongoDB ou um array na memória.

```typescript
export interface QuestionsRepository {
  findById(id: string): Promise<Question | null>
  findBySlug(slug: string): Promise<Question | null>
  findManyRecent(params: PaginationParams): Promise<Question[]>
  save(question: Question): Promise<void>
  create(question: Question): Promise<void>
  delete(question: Question): Promise<void>
}
```

Isso permite:

- **Testar** com repositórios in-memory (rápido, sem banco) — veja `test/repositories/`
- **Trocar** o banco de dados sem alterar regras de negócio
- **Manter** o domínio puro e independente de infraestrutura

---

## Casos de Uso (Use Cases)

### O que são?

São a camada de **aplicação** — orquestram entidades e repositórios para executar uma ação de negócio completa.

### Exemplo: CreateQuestionUseCase

```typescript
export class CreateQuestionUseCase {
  constructor(private questionsRepository: QuestionsRepository) {}

  async execute({
    authorId,
    title,
    content,
    attachmentsIds,
  }: CreateQuestionUseCaseRequest): Promise<CreateQuestionUseCaseResponse> {
    // 1. Cria a entidade Question
    const question = Question.create({
      authorId: new UniqueEntityID(authorId),
      title,
      content,
    })

    // 2. Cria os anexos e associa via WatchedList
    const questionAttachments = attachmentsIds.map((attachmentId) =>
      QuestionAttachment.create({
        attachmentId: new UniqueEntityID(attachmentId),
        questionId: question.id,
      }),
    )
    question.attachments = new QuestionAttachmentList(questionAttachments)

    // 3. Persiste via repositório (interface)
    await this.questionsRepository.create(question)

    // 4. Retorna sucesso via Either
    return right({ question })
  }
}
```

O caso de uso:

- **Não sabe** qual banco está usando (depende de interface)
- **Não sabe** sobre HTTP, controllers ou frameworks
- **Retorna** `Either` em vez de lançar exceções
- **Coordena** a criação de entidades e a persistência

---

## Observação sobre o estado atual

Os controllers HTTP (`src/controllers/`) ainda acessam `PrismaService` diretamente em alguns casos. Isso indica uma fase de transição — o modelo de domínio e os use cases DDD já existem, mas a camada de entrada HTTP ainda pode evoluir para chamar os use cases em vez de falar diretamente com o banco.

---

## Resumo Visual

```
┌─────────────────────────────────────────────────────────────┐
│                      CORE (genérico)                        │
│  Entity ← AggregateRoot ← DomainEvents ← WatchedList       │
│  UniqueEntityID    Either    UseCaseError                   │
└─────────────────────────────────────────────────────────────┘
                          ▲ herda/usa
┌─────────────────────────────────────────────────────────────┐
│                   DOMAIN: FORUM                             │
│                                                             │
│  enterprise/            │  application/                     │
│  ├── Question (AR)      │  ├── CreateQuestionUseCase        │
│  ├── Answer (AR)        │  ├── AnswerQuestionUseCase        │
│  ├── Comment            │  ├── EditQuestionUseCase          │
│  ├── Student            │  ├── DeleteQuestionUseCase        │
│  ├── Slug (VO)          │  └── QuestionsRepository (interface)│
│  └── Events             │                                   │
└───────────────────────┼─────────────────────────────────────┘
                        │ eventos
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 DOMAIN: NOTIFICATION                        │
│                                                             │
│  enterprise/           │  application/                      │
│  └── Notification      │  ├── SendNotificationUseCase       │
│                        │  ├── ReadNotificationUseCase       │
│                        │  └── subscribers/                  │
│                        │      ├── OnAnswerCreated            │
│                        │      └── OnQuestionBestAnswerChosen │
└────────────────────────┴────────────────────────────────────┘

AR = Aggregate Root    VO = Value Object
```

---

## Glossário Rápido

| Conceito            | Definição                                                                              |
| ------------------- | -------------------------------------------------------------------------------------- |
| **Entity**          | Objeto com identidade única. Igualdade por ID.                                         |
| **Value Object**    | Objeto sem identidade. Igualdade por atributos. Imutável.                              |
| **Aggregate**       | Grupo de entidades tratadas como unidade. Tem uma raiz (Aggregate Root).               |
| **Aggregate Root**  | Entidade raiz do agregado. Único ponto de acesso externo. Pode disparar eventos.       |
| **Watched List**    | Lista que rastreia adições e remoções para persistência eficiente.                     |
| **Domain Event**    | Fato que aconteceu no domínio. Permite comunicação desacoplada entre contextos.        |
| **Bounded Context** | Fronteira lógica de um domínio. Cada contexto tem suas próprias entidades e regras.    |
| **Repository**      | Interface que abstrai a persistência. O domínio define o contrato, a infra implementa. |
| **Use Case**        | Orquestra entidades e repositórios para executar uma ação de negócio.                  |
| **Either**          | Pattern funcional para retornos que podem ser sucesso (`Right`) ou erro (`Left`).      |

# Events: GTS

## gtsAdd
Données:
```ts
{
  creature: {
    id: string;
    level: number;
    shiny: boolean;
    form: number;
    nature: number;
    // ... propriétés supplémentaires acceptées
  };
  require_conditions: {
    id: string;
    level: { min: number; max?: number };
    shiny?: boolean;
    form?: number;
    nature?: number;
  };
}
```
Réponse:
```ts
{ success: boolean; message: string }
```

## gtsRemove
Données: `null`

Réponse:
```ts
{ success: boolean; message: string }
```

## gtsTrade
Données:
```ts
{
  playerA_id: string;
  offeredCreature: {
    id: string;
    species: string;
    level: number;
    shiny: boolean;
    form: number;
    nature: number;
    data: string;
  };
}
```
Réponse:
```ts
{ success: boolean; message: string; receivedCreature?: Record<string, unknown> }
```

## gtsAllList
Données (filtres):
```ts
{
  db_symbol?: string;
  level?: { min?: number; max?: number };
  shiny?: boolean;
  form?: number;
  nature?: number;
}
```
Réponse:
```ts
{ success: boolean; creatures?: IGts[]; message?: string }
```


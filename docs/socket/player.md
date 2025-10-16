# Events: Player

## playerCreate

Données:
```ts
{
  id: string;
  name: string;
  is_girl?: boolean;
  charset_base?: string;
}
```
Réponse:
```ts
{ success: boolean; message: string; friend_code?: string }
```

## playerUpdate

Données:
```ts
Record<string, unknown>
```
Réponse:
```ts
{ success: boolean; message: string; data?: IPlayer }
```

## playerDelete

Données: `null`

Réponse:
```ts
{ success: boolean; message: string }
```


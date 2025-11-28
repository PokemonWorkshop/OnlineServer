# Events: Gift

## giftList
Données: `null`

Réponse:
```ts
{
  success: boolean;
  message: string;
  list_gift?: { id: string; title: string }[];
}
```

## giftClaim
Données:
```ts
{ id?: string; code?: string }
```
Réponse:
```ts
{
  success: boolean;
  message: string;
  gifts?: {
    id: string;
    title: string;
    items: { id: string; count: number }[];
    creatures: ICreature[];
    eggs: IEgg[];
  };
  errors?: { path: string; message: string }[];
}
```

## giftClaimById
Données:
```ts
{ id: string }
```
Réponse: identique à `giftClaim`.

## giftClaimByCode
Données:
```ts
{ code: string }
```
Réponse: identique à `giftClaim`.


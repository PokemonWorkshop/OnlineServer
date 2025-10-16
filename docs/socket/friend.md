# Events: Friend

## friendRequest
Données:
```ts
{ toFriendCode: string }
```
Réponse:
```ts
{ success: boolean; message: string }
```

## friendAccept
Données:
```ts
{ senderId: string }
```
Réponse:
```ts
{ success: boolean; message: string }
```

## friendDecline
Données:
```ts
{ senderId: string }
```
Réponse:
```ts
{ success: boolean; message: string }
```

## friendRemove
Données:
```ts
{ friendId: string }
```
Réponse:
```ts
{ success: boolean; message: string }
```

## friendList
Données: `null`

Réponse:
```ts
{ success: boolean; data?: { id: string; name: string; friendCode: string }[]; message?: string }
```

## friendPending
Données: `null`

Réponse:
```ts
{ success: boolean; data?: { id: string; name: string; friendCode: string }[]; message?: string }
```


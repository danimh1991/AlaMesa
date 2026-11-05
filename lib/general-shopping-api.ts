const SHOPPING_API_ITEMS_URL = 'https://danieta.com/listacompra/api/items';

export type GeneralShoppingItem = {
  id: number;
  name: string;
  quantity?: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type AddShoppingItemResponse = {item: GeneralShoppingItem};

function apiErrorMessage(status: number, body: unknown) {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const detail = record.error ?? record.message;
    if (typeof detail === 'string' && detail.trim()) return detail;
  }
  return `La lista general ha respondido con un error (${status}).`;
}

export async function addShoppingItem(name: string, quantity?: string): Promise<GeneralShoppingItem> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('El nombre del artículo no puede estar vacío.');

  const cleanQuantity = quantity?.trim();
  let response: Response;
  try {
    response = await fetch(SHOPPING_API_ITEMS_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        name: cleanName,
        ...(cleanQuantity ? {quantity: cleanQuantity} : {}),
      }),
    });
  } catch {
    throw new Error('No se ha podido conectar con la lista general. Comprueba la conexión e inténtalo de nuevo.');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) throw new Error(apiErrorMessage(response.status, body));
  if (response.status !== 201 || !body || typeof body !== 'object' || !('item' in body)) {
    throw new Error('La lista general ha devuelto una respuesta inesperada.');
  }

  return (body as AddShoppingItemResponse).item;
}

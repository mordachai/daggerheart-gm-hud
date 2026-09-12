// module/system/items.mjs - the only place that knows Daggerheart item/chat internals

/** Send an item's real ability card to chat (documents/item.mjs: item.toChat requires a uuid). */
export async function sendToChat(item) {
  if (!item) return;
  await item.toChat(item.uuid);
}

/** Whether this item instance actually has any usable actions (not just the item type supporting them). */
export function featureHasActions(item) {
  const list = item?.system?.actionsList;
  return (list?.size ?? list?.length ?? 0) > 0;
}

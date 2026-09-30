/* An empty cached stamp asks the server for the object's column metadata plus its current column-cache version (286 = Contacts, 456 = Service Order form). */
export const contactObjectColumnsPayload = (objectId: number) => [objectId, '', 0, '', []];

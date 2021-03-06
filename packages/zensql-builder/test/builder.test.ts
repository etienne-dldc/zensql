import { CreateTable, ColumnDef, DataType } from '../src';

it('build a create table', () => {
  expect(
    CreateTable('doc', [ColumnDef('id', DataType.UUID()), ColumnDef('name', DataType.TEXT())])
  ).toEqual({
    items: [
      {
        constraints: [],
        dataType: { dt: { type: 'UUID' }, tsType: null, type: 'DataType' },
        name: { caseSensitive: false, originalValue: 'id', type: 'Identifier', value: 'id' },
        type: 'ColumnDef',
      },
      {
        constraints: [],
        dataType: { dt: { type: 'TEXT' }, tsType: null, type: 'DataType' },
        name: { caseSensitive: false, originalValue: 'name', type: 'Identifier', value: 'name' },
        type: 'ColumnDef',
      },
    ],
    table: {
      schema: null,
      table: { caseSensitive: false, originalValue: 'doc', type: 'Identifier', value: 'doc' },
      type: 'Table',
    },
    type: 'CreateTableStatement',
  });
});

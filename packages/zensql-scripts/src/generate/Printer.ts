import path from 'path';
import fse from 'fs-extra';
import { QueryResolved, SelectQueryResolved, InsertQueryResolved } from './Query';
import { Variable } from './Variable';
import { saveFile } from '../common/utils';
import { ColumnType } from '../common/ColumnUtils';
import { Serializer } from '@zensql/parser';

export const Printer = {
  print,
};

interface Options {
  targetPath: string;
  queries: Array<QueryResolved>;
}

async function print(options: Options): Promise<void> {
  const { targetPath, queries } = options;

  await fse.ensureDir(path.dirname(targetPath));

  const content = [
    `/**`,
    ` * This file has been generated by ZenSQL`,
    ' *  Do not change this file, intead you should changes your queries and execute `stq-ts` again',
    ` */`,
    ``,
    `import { Pool, QueryResult } from "pg";`,
    ``,
    printQueries(queries),
  ].join('\n');

  await saveFile(targetPath, content);
}

function printQueries(queries: Array<QueryResolved>): string {
  return [
    ``,
    queries.map(v => printQuery(v)).join('\n\n'),
    ``,
    `export const QUERIES = {`,
    queries.map(v => `  ${v.name},`).join('\n'),
    `}`,
  ].join('\n');
}

function printQuery(query: QueryResolved): string {
  if (query.type === 'Select') {
    return printSelectQuery(query);
  }
  if (query.type === 'Insert') {
    return printInsertQuery(query);
  }
  throw new Error('Not implemented yet');
}

function printInsertQuery(query: InsertQueryResolved): string {
  const outQuery = Variable.replace(query.query, query.variables);

  const option =
    query.variables.length === 0
      ? null
      : query.variables.length === 1
      ? `${query.variables[0].name}: ${generateTypes(query.variables[0].type)}`
      : `params: { ${query.variables.map(v => `${v.name}: ${generateTypes(v.type)}`).join('; ')} }`;

  return [
    `function ${query.name}(pool: Pool${option ? ', ' + option : ''}): Promise<QueryResult<{}>> {`,
    query.variables.length > 1 ? `  const { ${query.variables.map(v => v.name).join(', ')} } = params;` : null,
    `  return pool.query(`,
    `    \`${Serializer.serialize(outQuery)}\`,`,
    `    [${query.variables.map(v => v.name).join(', ')}]`,
    `  );`,
    `}`,
  ]
    .filter(v => v !== null)
    .join('\n');
}

function printSelectQuery(query: SelectQueryResolved): string {
  const outQuery = Variable.replace(query.query, query.variables);
  const interfaceName = query.name.substring(0, 1).toUpperCase() + query.name.substring(1) + 'Result';

  const option =
    query.variables.length === 0
      ? null
      : query.variables.length === 1
      ? `${query.variables[0].name}: ${generateTypes(query.variables[0].type)}`
      : `params: { ${query.variables.map(v => `${v.name}: ${generateTypes(v.type)}`).join('; ')} }`;

  return [
    `interface ${interfaceName} {`,
    ...query.columns.map(col => {
      return `  ${col.alias ? col.alias : col.column}: ${generateTypes(col.type)};`;
    }),
    `}`,
    ``,
    `function ${query.name}(pool: Pool${option ? ', ' + option : ''}): Promise<QueryResult<${interfaceName}>> {`,
    query.variables.length > 1 ? `  const { ${query.variables.map(v => v.name).join(', ')} } = params;` : null,
    `  return pool.query(`,
    `    \`${Serializer.serialize(outQuery)}\`,`,
    `    [${query.variables.map(v => v.name).join(', ')}]`,
    `  );`,
    `}`,
  ]
    .filter(v => v !== null)
    .join('\n');
}

function generateTypes(type: ColumnType | null): string {
  if (type === null) {
    return 'any';
  }
  const dt = type.dt.dt;
  const base = (() => {
    switch (dt) {
      case 'BOOL':
      case 'BOOLEAN':
        return 'boolean';
      case 'CHAR':
      case 'CHARACTER':
      case 'VARCHAR':
      case 'UUID':
      case 'TEXT':
      case 'DATE':
      case 'TIMESTAMPTZ':
        return 'string';
      case 'DECIMAL':
      case 'INT':
      case 'INTEGER':
      case 'NUMERIC':
      case 'REAL':
      case 'SERIAL':
      case 'SMALLINT':
        return 'number';
      case 'JSON':
      case 'JSONB':
        return 'any';
      default:
        throw new Error(`Unhandled type ${type.dt.type} (${dt})`);
    }
  })();
  if (type.nullable) {
    return `${base} | null`;
  }
  return base;
}

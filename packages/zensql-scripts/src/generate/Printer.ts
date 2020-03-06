import path from 'path';
import fse from 'fs-extra';
import {
  QueryResolved,
  SelectQueryResolved,
  InsertQueryResolved,
  UpdateQueryResolved,
} from './Query';
import { Variable } from './Variable';
import { saveFile } from '../common/utils';
import { ColumnType } from '../common/ColumnUtils';
import { Serializer } from '@zensql/serializer';
import { Node, Null } from '@zensql/ast';
import { VariableResolved } from '../common/ExpressionUtils';

interface Import {
  module: string;
  names: Array<string>;
}

interface ContentWithImports {
  content: string;
  imports: Array<Import>;
}

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

  const { content, imports } = printQueries(queries);

  const fileContent = [
    `/**`,
    ` * This file has been generated by ZenSQL`,
    ' *  Do not change this file, instead you should changes your queries and run ZenSQL again',
    ` */`,
    ``,
    `import { Pool, QueryResult } from "pg";`,
    ...normalizeImports(imports).map(
      imp => `import { ${imp.names.join(', ')} } from '${imp.module}';`
    ),
    ``,
    content,
  ].join('\n');

  await saveFile(targetPath, fileContent);
}

function printQueries(queries: Array<QueryResolved>): ContentWithImports {
  return {
    content: [
      ``,
      queries.map(v => printQuery(v).content).join('\n\n'),
      ``,
      `export const QUERIES = {`,
      queries.map(v => `  ${v.name},`).join('\n'),
      `}`,
    ].join('\n'),
    imports: queries.reduce<Array<Import>>((acc, v) => {
      acc.push(...printQuery(v).imports);
      return acc;
    }, []),
  };
}

function printQuery(query: QueryResolved): ContentWithImports {
  if (query.type === 'Select') {
    return printSelectQuery(query);
  }
  if (query.type === 'Insert' || query.type === 'Update') {
    return printInsertOrUpdateQuery(query);
  }
  throw new Error('Not implemented yet');
}

function printInsertOrUpdateQuery(
  query: InsertQueryResolved | UpdateQueryResolved
): ContentWithImports {
  const outQuery = Variable.replace(query.query, query.variables);

  const option = printOptions(query.variables);

  return {
    content: [
      `function ${query.name}(pool: Pool${
        option ? ', ' + option.content : ''
      }): Promise<QueryResult<{}>> {`,
      query.variables.length > 1
        ? `  const { ${query.variables.map(v => v.name).join(', ')} } = params;`
        : null,
      `  return pool.query(`,
      `    \`${Serializer.serialize(outQuery)}\`,`,
      `    [${query.variables.map(v => v.name).join(', ')}]`,
      `  );`,
      `}`,
    ]
      .filter(v => v !== null)
      .join('\n'),
    imports: option === null ? [] : option.imports,
  };
}

function printSelectQuery(query: SelectQueryResolved): ContentWithImports {
  const outQuery = Variable.replace(query.query, query.variables);
  const interfaceName =
    query.name.substring(0, 1).toUpperCase() + query.name.substring(1) + 'Result';

  const option = printOptions(query.variables);
  const columnsImports = query.columns.reduce<Array<Import>>((acc, col) => {
    acc.push(...generateTypes(col.type).imports);
    return acc;
  }, []);

  return {
    content: [
      `export interface ${interfaceName} {`,
      ...query.columns.map(col => {
        return `  ${col.alias ? col.alias : col.column}: ${generateTypes(col.type).content};`;
      }),
      `}`,
      ``,
      `function ${query.name}(pool: Pool${
        option ? ', ' + option.content : ''
      }): Promise<QueryResult<${interfaceName}>> {`,
      query.variables.length > 1
        ? `  const { ${query.variables.map(v => v.name).join(', ')} } = params;`
        : null,
      `  return pool.query(`,
      `    \`${Serializer.serialize(outQuery)}\`,`,
      `    [${query.variables.map(v => v.name).join(', ')}]`,
      `  );`,
      `}`,
    ]
      .filter(v => v !== null)
      .join('\n'),
    imports: [...(option === null ? [] : option.imports), ...columnsImports],
  };
}

function printOptions(variables: Array<VariableResolved>): ContentWithImports | null {
  if (variables.length === 0) {
    return null;
  }
  if (variables.length === 1) {
    const t = generateTypes(variables[0].type);
    return {
      content: `${variables[0].name}: ${t.content}`,
      imports: t.imports,
    };
  }
  const imports = variables.reduce<Array<Import>>((acc, v) => {
    acc.push(...generateTypes(v.type).imports);
    return acc;
  }, []);
  return {
    content: `params: { ${variables
      .map(v => `${v.name}: ${generateTypes(v.type).content}`)
      .join('; ')} }`,
    imports: imports,
  };
}

function generateTypes(column: ColumnType | null | Null): ContentWithImports {
  if (column === null) {
    return {
      content: 'any',
      imports: [],
    };
  }
  if ('type' in column && Node.is('Null', column)) {
    return {
      content: 'null',
      imports: [],
    };
  }
  const imports: Array<Import> = [];
  const dtName = column.dt.dt.type;
  const base = (() => {
    if (column.dt.tsType !== null) {
      const tsType = column.dt.tsType;
      if (Node.is('TsInlineType', tsType)) {
        return tsType.typeStr;
      }
      if (Node.is('TsExternalType', tsType)) {
        imports.push({
          module: tsType.module,
          names: [tsType.typeName],
        });
        return tsType.typeName;
      }
      throw new Error(`Unhandled TsType ${(tsType as any).type}`);
    }
    switch (dtName) {
      case 'BOOL':
      case 'BOOLEAN':
        return 'boolean';
      case 'CHAR':
      case 'CHARACTER':
      case 'VARCHAR':
      case 'UUID':
      case 'TEXT':
        return 'string';
      case 'DATE':
      case 'TIMESTAMPTZ':
        // TODO: Is this a Date instead ?
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
        throw new Error(`Unhandled type ${column.dt.type} (${dtName})`);
    }
  })();
  return {
    content: column.nullable ? `${base} | null` : base,
    imports,
  };
}

function normalizeImports(imports: Array<Import>): Array<Import> {
  const out: Map<string, Set<string>> = new Map();
  imports.forEach(imp => {
    if (out.has(imp.module) === false) {
      out.set(imp.module, new Set());
    }
    const names = out.get(imp.module);
    if (names) {
      imp.names.forEach(n => names.add(n));
    }
  });
  return Array.from(out.entries()).map(
    ([module, names]): Import => {
      return {
        module,
        names: Array.from(names.values()),
      };
    }
  );
}

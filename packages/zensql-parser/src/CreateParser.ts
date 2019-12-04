import { TokenStream } from './core/TokenStream';
import { Node, DataType, Identifier, Constraint } from './core/Node';
import { ParserUtils } from './utils/ParserUtils';
import { DataTypes } from './utils/DataType';

export function CreateParser(input: TokenStream) {
  const {
    skipKeyword,
    parseIdentifier,
    isPunctuation,
    skipPunctuation,
    parseMultiple,
    skipComment,
    isDataType,
    skipDataType,
    unexpected,
    parseInteger,
    isKeyword,
    parseTable,
    createNode,
  } = ParserUtils(input);

  return {
    parseCreateStatement,
  };

  function parseCreateStatement(): Node<'CreateTableStatement'> {
    skipKeyword('CREATE');
    skipKeyword('TABLE');
    const table = parseTable();
    skipPunctuation('(');
    const columns = parseMultiple(',', parseColumnDef);
    skipPunctuation(')');
    return createNode('CreateTableStatement', { table, columns });
  }

  function parseColumnDef(): Node<'ColumnDef'> {
    skipComment();
    const name = parseIdentifier(false);
    const dataType = parseDataType();
    const constraints = parseConstraints();

    return createNode('ColumnDef', {
      dataType,
      name,
      constraints,
    });
  }

  function parseConstraints(): Array<Constraint> {
    const result: Array<Constraint> = [];
    let next = parseConstraint();
    while (!input.eof() && next) {
      result.push(next);
      next = parseConstraint();
    }
    return result;
  }

  function parseConstraint(): Constraint | null {
    return parseMaybeNotNull() || parseMaybePrimaryKey() || parseMaybeUnique() || parseMaybeReference();
  }

  function parseMaybeUnique(): Node<'UniqueConstraint'> | null {
    if (isKeyword('UNIQUE')) {
      skipKeyword('UNIQUE');
      return createNode('UniqueConstraint', {});
    }
    return null;
  }

  function parseMaybeNotNull(): Node<'NotNullConstraint'> | null {
    if (isKeyword('NOT')) {
      skipKeyword('NOT');
      skipKeyword('NULL');
      return createNode('NotNullConstraint', {});
    }
    return null;
  }

  function parseMaybePrimaryKey(): Node<'PrimaryKeyConstraint'> | null {
    if (isKeyword('PRIMARY')) {
      skipKeyword('PRIMARY');
      skipKeyword('KEY');
      return createNode('PrimaryKeyConstraint', {});
    }
    return null;
  }

  function parseMaybeReference(): null | Node<'ReferenceConstraint'> {
    if (!isKeyword('REFERENCES')) {
      return null;
    }
    skipKeyword('REFERENCES');
    const first = parseIdentifier(false);
    let second: Identifier | null = null;
    if (isPunctuation('.')) {
      skipPunctuation('.');
      second = parseIdentifier(true);
    }
    skipPunctuation('(');
    const column = parseIdentifier(false);
    skipPunctuation(')');

    const [schema, table] = second ? [first, second] : [null, first];
    const foreignKey = createNode('Column', {
      schema,
      table,
      column,
    });
    return createNode('ReferenceConstraint', { foreignKey });
  }

  function parseDataType(): DataType {
    const dtTok = isDataType();
    if (dtTok === false) {
      return unexpected();
    }
    const dt = dtTok.value.toUpperCase();
    skipDataType();
    if (DataTypes.isNoParamsDataType(dt)) {
      return createNode('DataTypeNoParams', { dt });
    }
    if (DataTypes.isIntParamDataType(dt)) {
      const param = parseMaybeIntParam();
      return createNode('DataTypeIntParams', { dt, param });
    }
    if (DataTypes.isNumericDataType(dt)) {
      return createNode('DataTypeNumeric', {
        dt,
        params: parseMaybeNumericParams(),
      });
    }
    return unexpected(`Unknow DataType ${dt}`);
  }

  function parseMaybeIntParam(): number | null {
    if (isPunctuation('(')) {
      skipPunctuation('(');
      const val = parseInteger();
      skipPunctuation(')');
      return val;
    }
    return null;
  }

  function parseMaybeNumericParams(): null | { p: number; s: number } {
    if (isPunctuation('(')) {
      skipPunctuation('(');
      const p = parseInteger();
      skipPunctuation(',');
      const s = parseInteger();
      skipPunctuation(')');
      return { p, s };
    }
    return null;
  }
}

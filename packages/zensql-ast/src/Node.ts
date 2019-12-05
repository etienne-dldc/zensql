import { BooleanOperator, CompareOperator, ValueOperator } from './Operator';
import { DataTypeIntParam, DataTypeNoParams, DataTypeNumeric } from './DataType';

export interface Nodes {
  // Basics
  String: { value: string };
  Numeric: { value: number };
  Boolean: { value: boolean };
  Null: {};
  Comment: { value: string };

  // Variables
  NamedVariable: { name: string };
  IndexedVariable: { num: number };

  // Identifier
  Identifier: {
    // the value as used by Postgres in lowercas
    value: string;
    // original value for linteng purpose
    originalValue: string;
  };
  CaseSensitiveIdentifier: { value: string };

  // Expression
  When: {
    condition: Expression;
    then: Term;
  };
  Case: {
    term: Term;
    cases: Array<Node<'When'>>;
    else: Expression | null;
  };
  CaseWhen: {
    cases: Array<Node<'When'>>;
    else: Expression | null;
  };
  BooleanOperation: {
    left: Expression;
    operator: BooleanOperator;
    right: Expression;
  };
  CompareOperation: {
    left: Expression;
    operator: CompareOperator;
    right: Expression;
  };
  ValueOperation: {
    left: Expression;
    operator: ValueOperator;
    right: Expression;
  };

  // Column
  Column: {
    schema: Identifier | null;
    table: Identifier | null;
    column: Identifier;
  };
  ColumnAlias: {
    schema: Identifier | null;
    table: Identifier | null;
    column: Identifier;
    alias: Identifier;
  };
  ColumnAll: {};
  ColumnAllFromTable: { schema: Identifier | null; table: Identifier };

  // Table
  Table: { schema: Identifier | null; table: Identifier };
  TableAlias: {
    table: Node<'Table'>;
    alias: Identifier;
  };

  // Join
  LeftJoin: {
    left: TableExpression;
    right: TableExpression;
    condition: Expression;
  };

  // From
  FromExpression: {
    tables: Array<TableExpression>;
    where: Expression | null;
  };

  // Constraints
  NotNullConstraint: {};
  PrimaryKeyConstraint: {};
  UniqueConstraint: {};
  ReferenceConstraint: {
    foreignKey: Node<'Column'>;
  };
  PrimaryKeyTableConstraint: {
    columns: Array<Identifier>;
  };

  // ColumnDef
  ColumnDef: {
    name: Identifier;
    dataType: DataType;
    constraints: Array<Constraint>;
  };

  // DataTypes
  DataTypeNoParams: {
    dt: DataTypeNoParams;
  };
  DataTypeIntParams: {
    dt: DataTypeIntParam;
    param: null | number;
  };
  DataTypeNumeric: {
    dt: DataTypeNumeric;
    params: null | { p: number; s: number };
  };

  InserValues: {
    values: Array<Expression>;
  };

  // Statements
  Empty: {};
  SelectStatement: {
    select: SelectExpression;
    from: Node<'FromExpression'>;
  };
  InsertIntoStatement: {
    table: Node<'Table' | 'TableAlias'>;
    columns: Array<Identifier> | null;
    values: Array<Node<'InserValues'>>;
  };
  CreateTableStatement: {
    table: Node<'Table'>;
    items: Array<Node<'ColumnDef'> | TableConstraint>;
  };
  AlterTableStatement: {
    table: Node<'Table'>;
  };
}

export type Cursor = {
  line: number;
  column: number;
};

export interface NodeCommon {
  cursor?: Cursor;
}

export type NodeType = keyof Nodes;

export type Node<K extends NodeType = NodeType> = Nodes[K] & { type: K } & NodeCommon;

const NODES_OBJ: { [K in NodeType]: null } = {
  AlterTableStatement: null,
  Boolean: null,
  BooleanOperation: null,
  Case: null,
  CaseSensitiveIdentifier: null,
  CaseWhen: null,
  Column: null,
  ColumnAlias: null,
  ColumnAll: null,
  ColumnAllFromTable: null,
  ColumnDef: null,
  Comment: null,
  CompareOperation: null,
  CreateTableStatement: null,
  DataTypeIntParams: null,
  DataTypeNoParams: null,
  DataTypeNumeric: null,
  Empty: null,
  FromExpression: null,
  Identifier: null,
  IndexedVariable: null,
  InsertIntoStatement: null,
  InserValues: null,
  LeftJoin: null,
  NamedVariable: null,
  NotNullConstraint: null,
  Null: null,
  Numeric: null,
  PrimaryKeyConstraint: null,
  PrimaryKeyTableConstraint: null,
  ReferenceConstraint: null,
  SelectStatement: null,
  String: null,
  Table: null,
  TableAlias: null,
  UniqueConstraint: null,
  ValueOperation: null,
  When: null,
};

const NODES = Object.keys(NODES_OBJ) as Array<NodeType>;

export const NodeIs: {
  [K in NodeType]: (node: Node) => node is Node<K>;
} = NODES.reduce<any>((acc, key) => {
  acc[key] = (node: Node) => node.type === key;
  return acc;
}, {});

// Alias
export type Identifier = Node<'Identifier' | 'CaseSensitiveIdentifier'>;
export type Value = Node<
  'CaseSensitiveIdentifier' | 'Identifier' | 'String' | 'Numeric' | 'Boolean' | 'Null'
>;
export type Variable = Node<'NamedVariable' | 'IndexedVariable'>;
export type Term = Value | Variable | Node<'Column'>;
export type BinaryOperation = Node<'BooleanOperation' | 'CompareOperation' | 'ValueOperation'>;
export type Expression = BinaryOperation | Term;
export type DataType = Node<'DataTypeNoParams' | 'DataTypeNumeric' | 'DataTypeIntParams'>;
export type TableExpression = Node<'TableAlias' | 'Table' | 'LeftJoin'>;
export type SelectExpressionItem = Node<
  'Column' | 'ColumnAlias' | 'ColumnAll' | 'ColumnAllFromTable'
>;
export type SelectExpression = Array<SelectExpressionItem>;
export type Constraint = Node<
  'NotNullConstraint' | 'PrimaryKeyConstraint' | 'UniqueConstraint' | 'ReferenceConstraint'
>;
export type TableConstraint = Node<'PrimaryKeyTableConstraint'>;

export type Statement = Node<
  'SelectStatement' | 'CreateTableStatement' | 'InsertIntoStatement' | 'AlterTableStatement'
>;
export type Statements = Array<Statement>;

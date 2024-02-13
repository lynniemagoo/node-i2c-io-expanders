module.exports = {
    parser: '@typescript-eslint/parser', // Specifies the ESLint parser
    parserOptions: {
        ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
        sourceType: 'module', // Allows for the use of imports
        project: [
          './tsconfig.json',
          './examples/pcf8574/tsconfig.json',
          './examples/pcf8575/tsconfig.json',
          './examples/mcp23017/tsconfig.json',
          './examples/mcp23008/tsconfig.json',
          './examples/cat9555/tsconfig.json'
        ],
    },
    extends: [
        'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    ],
    plugins: [],
    rules: {
        'indent': 'off',
        '@typescript-eslint/indent': [
            'error',
            2,
            {
                'SwitchCase': 1
            }
        ],
        'quotes': [
            'error',
            'single',
            {
                'avoidEscape': true,
                'allowTemplateLiterals': true
            }
        ],
        '@typescript-eslint/no-parameter-properties': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-use-before-define': [
            'error',
            {
                functions: false,
                typedefs: false,
                classes: false,
            },
        ],
        '@typescript-eslint/no-unused-vars': [
            'warn',
            {
                ignoreRestSiblings: true,
                argsIgnorePattern: '^_',
            },
        ],
        '@typescript-eslint/explicit-function-return-type': [
            'warn',
            {
                allowExpressions: true,
                allowTypedFunctionExpressions: true,
            },
        ],
        '@typescript-eslint/no-object-literal-type-assertion': 'off',
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off', // This is necessary for Map.has()/get()!
        '@typescript-eslint/no-unsafe-declaration-merging': 'off',
        'no-var': 'error',
        'prefer-const': 'error',
        'no-trailing-spaces': 'warn',
    }
};
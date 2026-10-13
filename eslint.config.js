import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Provider modules export their hook alongside the component by design.
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['useAuth', 'useUserId', 'useToast', 'buttonClasses'] },
      ],
      // This project does not use the React Compiler; the rule only reports that the
      // compiler would skip components using React Hook Form's watch().
      'react-hooks/incompatible-library': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/[·•]/]',
          message: 'Decorative centred dots are banned by the design system. Use spacing, a comma or <Divider vertical />.',
        },
        {
          selector: 'JSXText[value=/[·•]/]',
          message: 'Decorative centred dots are banned by the design system. Use spacing, a comma or <Divider vertical />.',
        },
      ],
    },
  },
)

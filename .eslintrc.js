module.exports = {
  "extends": "eslint:recommended",

  "parser": "babel-eslint",

  "parserOptions": {
    "sourceType": "script"
  },

  "env": {
    "browser": true,      // browser global variables.
    "jasmine": true,      // Jest global variables.
    "jest": true,         // Jest global variables.
    "node": true,         // Node.js global variables and Node.js-specific rules.
    "es6": true           // shelljs global variables.
  },

  "globals": {
  },

  "plugins": [
  ],

  "rules": {

    "no-console": 0,            // disallow use of console in the node environment (recommended)

    "block-scoped-var": 2,      // treat var statements as if they were block scoped (off by default)
    "consistent-return": 2,     // require return statements to either always or never specify values
    "curly": [2, "all"],        // specify curly brace conventions for all control statements
    "default-case": 2,          // require default case in switch statements (off by default)
    "dot-notation": 2,          // encourages use of dot notation whenever possible
    "eqeqeq": [2, "smart"],     // require the use of === and !==
    "guard-for-in": 0,          // make sure for-in loops have an if statement (off by default)
    "no-alert": 2,              // disallow the use of alert, confirm, and prompt
    "no-caller": 0,             // disallow use of arguments.caller or arguments.callee
    "no-div-regex": 2,          // disallow division operators explicitly at beginning of regular expression (off by default)
    "no-else-return": 2,        // disallow else after a return in an if (off by default)
    "no-eq-null": 2,            // disallow comparisons to null without a type-checking operator (off by default)
    "no-eval": 2,               // disallow use of eval()
    "no-extend-native": 2,      // disallow adding to native types
    "no-extra-bind": 2,         // disallow unnecessary function binding
    "no-fallthrough": 2,        // disallow fallthrough of case statements
    "no-floating-decimal": 0,   // disallow the use of leading or trailing decimal points in numeric literals (off by default)
    "no-implied-eval": 2,       // disallow use of eval()-like methods
    "no-iterator": 2,           // disallow usage of __iterator__ property
    "no-labels": 2,             // disallow use of labeled statements
    "no-lone-blocks": 2,        // disallow unnecessary nested blocks
    "no-loop-func": 2,          // disallow creation of functions within loops
    "no-multi-spaces": 0,       // disallow use of multiple spaces
    "no-multi-str": 0,          // disallow use of multiline strings
    "no-native-reassign": 2,    // disallow reassignments of native objects
    "no-new": 2,                // disallow use of new operator when not part of the assignment or comparison
    "no-new-func": 2,           // disallow use of new operator for Function object
    "no-new-wrappers": 2,       // disallows creating new instances of String, Number, and Boolean
    "no-octal": 0,              // disallow use of octal literals
    "no-octal-escape": 0,       // disallow use of octal escape sequences in string literals, such as var foo = "Copyright \251";
    "no-process-env": 2,        // disallow use of process.env (off by default)
    "no-proto": 2,              // disallow usage of __proto__ property
    "no-redeclare": 2,          // disallow declaring the same variable more then once
    "no-return-assign": 2,      // disallow use of assignment in return statement
    "no-script-url": 2,         // disallow use of javascript: urls.
    "no-self-compare": 2,       // disallow comparisons where both sides are exactly the same (off by default)
    "no-sequences": 2,          // disallow use of comma operator
    "no-unused-expressions": 2, // disallow usage of expressions in statement position
    "no-void": 2,               // disallow use of void operator (off by default)
    "no-warning-comments": 1,   // disallow usage of configurable warning terms in comments, e.g. TODO or FIXME (off by default)
    "no-with": 2,               // disallow use of the with statement
    "radix": 0,                 // require use of the second argument for parseInt() (off by default)
    "vars-on-top": 2,           // requires to declare all vars on top of their containing scope (off by default)
    "valid-jsdoc": [2, { "requireReturn": false }],
    "wrap-iife": [2, "any"],    // require immediate function invocation to be wrapped in parentheses (off by default)
    "yoda": 2,                  // require or disallow Yoda conditions


    ////////// Strict Mode //////////

    "strict": [2, "global"],          // controls location of Use Strict Directives


    ////////// Variables //////////

    "init-declarations": 0,           // enforce or disallow variable initializations at definition
    "no-catch-shadow": 0,             // disallow the catch clause parameter name being the same as a variable in the outer scope (off by default in the node environment)
    "no-delete-var": 2,               // disallow deletion of variables
    "no-label-var": 2,                // disallow labels that share a name with a variable
    "no-shadow-restricted-names": 2,  // disallow shadowing of names such as arguments
    "no-shadow": 2,                   // disallow declaration of variables already declared in the outer scope
    "no-undef-init": 2,               // disallow use of undefined when initializing variables
    "no-undef": 2,                    // disallow use of undeclared variables unless mentioned in a /*global */ block
    "no-undefined": 2,                // disallow use of undefined variable (off by default)
    "no-unused-vars": 2,              // disallow declaration of variables that are not used in the code
    "no-use-before-define": 0,        // disallow use of variables before they are defined


    ////////// Node.js //////////

    "callback-return": 2,             // enforce return after a callback
    "global-require": 0,              // enforce require() on top-level module scope
    "handle-callback-err": 2,         // enforce error handling in callbacks
    "no-mixed-requires": 0,           // disallow mixing regular variable and require declarations
    "no-new-require": 2,              // disallow use of new operator with the require function
    "no-path-concat": 0,              // disallow string concatenation with __dirname and __filename
    "no-process-exit": 2,             // disallow process.exit()
    "no-restricted-modules": 0,       // restrict usage of specified node modules
    "no-sync": 0,                     // disallow use of synchronous methods


    ////////// Stylistic Issues //////////

    "array-bracket-spacing": 2,                  // enforce spacing inside array brackets (fixable)
    "brace-style": [2, "allman", {
        "allowSingleLine": true
    }],                                          // enforce one true brace style (off by default)
    "camelcase": [2, {"properties": "never"}],   // require camel case names
    "comma-spacing": 2,                          // enforce spacing before and after comma
    "comma-style": 2,                            // enforce one true comma style (off by default)
    "computed-property-spacing": 2,              // enforces consistent naming when capturing the current execution context (off by default)
    "consistent-this": [2, "self"],              // enforces consistent naming when capturing the current execution context (off by default)
    "eol-last": 2,                               // enforce newline at the end of file, with no multiple empty lines
    "func-names": 0,                             // require function expressions to have a name (off by default)
    "func-style": 0,                             // enforces use of function declarations or expressions (off by default)
    "indent": [ 2, "tab", { "SwitchCase": 1 }],  // specify tab or space width for your code (fixable)
    "key-spacing": 2,                            // enforces spacing between keys and values in object literal properties
    "keyword-spacing": 2,                        // enforces spacing between keys and values in object literal properties
    "lines-around-comment": [ 2, {               // enforce empty lines around comments
      "allowBlockStart": true
    }],
    "max-depth": [2, 6],                         // specify the maximum depth that blocks can be nested (off by default)
    "max-len": 0,                                // specify the maximum length of a line in your program (off by default)
    "max-nested-callbacks": [2, 6],              // specify the maximum depth callbacks can be nested (off by default)
    "max-params": 0,                             // limits the number of parameters that can be used in the function declaration. (off by default)
    "max-statements": 0,                         // specify the maximum number of statement allowed in a function (off by default)
    "new-cap": 2,                                // require a capital letter for constructors
    "new-parens": 0,                             // disallow the omission of parentheses when invoking a constructor with no arguments
    "newline-after-var": 2,                      // require or disallow an empty newline after variable declarations
    "no-array-constructor": 2,                   // disallow use of the Array constructor
    "no-bitwise": 0,                             // disallow use of bitwise operators (off by default)
    "no-inline-comments": 0,                     // disallow comments inline after code (off by default)
    "no-lonely-if": 2,                           // disallow if as the only statement in an else block (off by default)
    "no-mixed-spaces-and-tabs": 2,               // disallow mixed spaces and tabs for indentation
    "no-multiple-empty-lines": 0,                // disallow multiple empty lines (off by default)
    "no-nested-ternary": 0,                      // disallow nested ternary expressions (off by default)
    "no-new-object": 2,                          // disallow use of the Object constructor
    "no-plusplus": 0,                            // disallow use of unary operators, ++ and -- (off by default)
    "no-spaced-func": 2,                         // disallow space between function identifier and application
    "no-ternary": 0,                             // disallow the use of ternary operators (off by default)
    "no-trailing-spaces": 2,                     // disallow trailing whitespace at the end of lines
    "no-unneeded-ternary": 2,                    // disallow the use of ternary operators when a simpler alternative exists
    "no-underscore-dangle": 0,                   // disallow dangling underscores in identifiers
    "object-curly-spacing": [2, "always"],       // require or disallow padding inside curly braces (fixable)
    "one-var": [2, "never"],                     // allow just one var statement per function (off by default)
    "operator-assignment": 2,                    // require assignment operator shorthand where possible or prohibit it entirely (off by default)
    "padded-blocks": [2, "never"],               // enforce padding within blocks (off by default)
    "quote-props": [2, "as-needed"],             // require quotes around object literal property names (off by default)
    "quotes": [2, "single", "avoid-escape"],     // specify whether double or single quotes should be used
    "semi": [2, "never"],                        // require or disallow use of semicolons instead of ASI
    "space-after-keywords": 0,                   // require a space after certain keywords (off by default)
    "space-before-blocks": 0,                    // require or disallow space before blocks (off by default)
    "space-before-function-paren": [2, "never"], // require a space after function names (off by default)
    "space-in-parens": [2, "never"],             // require or disallow spaces inside parentheses (off by default)
    "space-infix-ops": 2,                        // require spaces around operators
    "space-unary-ops": 2,                        // require or disallow spaces before/after unary operators (words on by default, nonwords off by default)
    "spaced-comment": 2,                         // require or disallow a space immediately following the // in a line comment (off by default)
    "template-curly-spacing": [2, "always"],     // enforce Usage of Spacing in Template Strings


    ////////// ECMAScript 6 //////////

    "arrow-body-style": 0,                       // require braces in arrow function body
    "arrow-parens": 0,                           // require parens in arrow function arguments
    "arrow-spacing": 2,                          // require space before/after arrow function's arrow (fixable)
    "constructor-super": 2,                      // verify calls of super() in constructors
    "generator-star-spacing": 0,                 // enforce spacing around the * in generator functions (fixable)
    "no-confusing-arrow": 2,                     // disallow arrow functions where a condition is expected
    "no-class-assign": 2 ,                       // disallow modifying variables of class declarations
    "no-const-assign": 2 ,                       // disallow modifying variables that are declared using const
    "no-dupe-class-members": 2,                  // disallow duplicate name in class members
    "no-this-before-super": 2,                   // disallow use of this/super before calling super() in constructors.
    "no-var": 2,                                 // require let or const instead of var
    "object-shorthand": 2,                       // require method and property shorthand syntax for object literals
    "prefer-arrow-callback": 2,                  // suggest using arrow functions as callbacks
    "prefer-const": 2,                           // suggest using const declaration for variables that are never modified after declared
    "prefer-reflect": 0,                         // suggest using Reflect methods where applicable
    "prefer-spread": 2,                          // suggest using the spread operator instead of .apply().
    "prefer-template": 2 ,                       // suggest using template literals instead of strings concatenation
    "require-yield": 0                          // disallow generator functions that do not have yield
  }
}

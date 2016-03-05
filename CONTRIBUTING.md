# Contributing

## Setup

1. Create `~/.nylas/dev/packages` if it does not exist
```
mkdir -p ~/.nylas/dev/packages
```
2. Clone the Cypher repository to `~/.nylas/dev/packages/cypher` by:
```
git clone https://github.com/mbilker/cypher ~/.nylas/dev/packages/cypher
```
3. Start N1 with debug flags or in developer mode (In the top menu bar "Developer" -> "Run with Debug Flags")

> Note: Whenever you make a change, run `eslint` to ensure all variables are defined. If you have an undefined variable, correct the error and re-run `eslint` and check the issue is fixed. Once the you have ensured that, restart N1 using  <kbd>Ctrl + Q</kbd> to fully exit N1. Closing the window does not suffice as N1 continues to run in the background.

# Neo Maggoo

Neo4j OGM for Node.js using proxified ES6 classes

**WARNING: This package is still in an experimental state, currently in active development and could change at any time.**

## Installation

```sh
npm install neo-maggoo --save
```


## Requirements
- Node.js >= 6.0.0
- Neo4j >= 3.0.0


## Usage

```js
const { Node, Relationship, DB } = require('neo-maggoo')

// Node definition
class Person extends Node {
    static get relationships()
    {
        return {
            relatives: {
                Model: Person,
                type: 'is_related_to',
                direction: Relationship.OUT
            },
            father: {
                Model: Person,
                type: 'is_father_of',
                direction: Relationship.IN,
                singular: true // Returns a single node instead of an array
            },
            mother: {
                Model: Person,
                type: 'is_mother_of',
                direction: Relationship.IN,
                singular: true // Returns a single node instead of an array
            }
        }
    }
}

// Initialize database connection
DB.init(NEO4J_BOLT_URL, NEO4J_USER, NEO4J_PASSWORD)
```


### READ

Get all nodes
```js
const people = await Person.all()
assert(people.length)
```

Get a single node
```js
// Find by UUID
const person = await Person.get('foo')
assert(person.id === 'foo')
```
```js
// Find by Neo4j ID (NOTE: this may change over time)
const person = await Person.get(1)
assert(person.$id === 1)
```

Find nodes using filter
```js
const people = await Person.find({ name: 'foo' })
assert(people[0].name === 'foo')
```
```js
const people = await Person.find({ name: 'foo' }, { with: 'relatives' })
assert(people[0].name === 'foo')
assert(people[0].relatives.length)
```

Find with related nodes
```js
const foo = await Person.get('foo', { with: 'relatives' })
assert(foo.relatives.length)
```
```js
const foo = await Person.get('foo', { with: 'father.father' })
assert(foo.father.id)
assert(foo.father.father.id)
```
```js
const foo = await Person.get('foo', { with: ['father.father', 'mother'] })
assert(foo.father.id)
assert(foo.father.father.id)
assert(foo.mother.id)
```
```js
const foo = await Person.get('foo', { with: { relatives: { name: 'bar' }, 'relatives.father': true } })
assert(foo.relatives[0].name === 'bar')
assert(foo.relatives[0].father.id)
```

Find nodes using query
```js
const people = await Person.query('MATCH (n) WHERE n.id = {id}', { id: foo }, { with: 'relatives' })
assert(people[0].id === 'foo')
assert(people[0].relatives.length)
```

Count nodes
```js
const total = await Person.count()
assert(total > 0)
```
```js
const total = await Person.count({ name: foo })
assert(total > 0)
```
```js
const total = await Person.count('WHERE n.name = {name}', { name: foo })
assert(total > 0)
```

### WRITE

Save an entire graph
```js
const foo = await Person.get('foo', { with: 'father' })
foo.father.name = 'baz'
await foo.save(true) // Will save foo.father
```

Save nested nodes
```js
const foo = new Person()
const bar = new Person()
foo.relatives.push(bar)
await foo.save(true) // Saves foo & bar, and creates a 'is_related_to' relationship
```

Delete collection
```js
const people = await Person.all()
await people.delete()
```

Delete an entire graph
```js
const foo = await Person.get('foo', { with: 'relatives' })
await foo.delete(true) // Deletes foo and its related nodes
```

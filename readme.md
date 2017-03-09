# Neo Maggoo

Neo4j OGM for Node.js using proxified ES6 classes

## Installation

```sh
npm install neo-maggoo --save
```

## Requirements
- Node.js >= ~6.0
- Neo4j >= 3.0

## Usage

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
assert(person.id == 'foo')
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
const people = await Person.find({ name: 'foo' }, { with: 'bar' })
assert(people[0].name === 'foo')
assert(people[0].bar.id)
```

Find with related nodes
```js
const foo = await Person.get('foo', { with: 'bar' })
assert(foo.bar.id)
```
```js
const foo = await Person.get('foo', { with: 'bar.baz' })
assert(foo.bar.id)
assert(foo.bar.baz.id)
```
```js
const foo = await Person.get('foo', { with: ['bar.baz', 'qux'] })
assert(foo.bar.id)
assert(foo.bar.baz.id)
assert(foo.qux.id)
```
```js
const foo = await Person.get('foo', { with: { bar: { id: 'bar' }, 'bar.baz': true } })
assert(foo.bar.id === 'bar')
assert(foo.bar.baz.id)
assert(foo.qux.id)
```

Find nodes using query
```js
const nodes = await Person.query('MATCH (n) WHERE n.id = {id}', { id: foo }, { with: 'baz' })
assert(nodes[0].id === 'foo')
```

Count nodes
```js
const total = Person.count()
assert(total > 0)
```
```js
const total = Person.count({ name: foo })
assert(total > 0)
```
```js
const total = Person.count('WHERE n.name = {name}', { name: foo })
assert(total > 0)
```

### WRITE

Save an entire graph
```js
const foo = Node.get('foo', { with: 'bar' })
foo.bar.name = 'baz'
await foo.save(true)
```

Save nested nodes
```js
const foo = new Person()
const bar = new Person()
foo.friends.push(bar)
await foo.save(true)
```

Delete collection
```js
const people = Person.all()
people.delete()
```

Delete an entire graph
```js
const video = Video.get({ with: 'shots' })
video.delete(true)
```
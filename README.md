# nimm-com
one store between environments 


# IDEA

1) Create something for React similar to redux but simpler, perfect for personal lightweight projects.
2) All actions boil down to operations on an existing object (or array)
3) Watch store 'sections' and execute logic when those sections change with descriptors describing that change
4) Provide experimental functionality to host one store over a client/server using socket.io.  (To run react on the server look into `nimm-react`)

## Create Store

```js
/* grab the factory */
const { createServer } = require("nimm-com");
const React = require('react');

/* create a state */
const Store={
    imageIds:[1,2,3],
    currentImageIds:3,
    images:[{id:1, username:'foo'}, {id:2, username:'bar'}, {id:3, username:'was'} ]
}

/* create store system which will give use the two hooks we care about */
const { useSelect, useCom } = createServer(React, State);

```

## useSelect

This hook is used to get data from store and expose manipulators which let up change that data.

```js
    const [imgs, operators] = useSelect(state=>state.images);
```

Behind the scenes useSelect creates a buffer of previous data selected.  On any manipulation of the store state (by using operators from useSelect), all buffers are checked and those which changed will rerun corresponding components (typical React stuff).  Keep that in mind and avoid selecting large data sets if memory is an issue.


## Operators

Here's a list of operators exposed by useSelect hook.

### merge

```js
    const [currentImage, {merge}] = useSelect(s=>s.currentImage);
    const onImageSelected = image => {
        merge({currentImage:image})
    }
```

Merge will merge the object into existing state at its root.  Unlike `update` merge will always ignore the selector and target the global state at its root.

You can give a function which should return an object to merge

```js
    merge(existingState=> {
        return {
            images: [...existingState.images, {id:4, username:'coolcat'}]
        }
    })
```

### update

```js
    const [currentImage, {update}] = useSelect(s=>s.currentImage);
    const markFavorite = () => {
        update({favorite:true})
    }
```

Update will update the object at a specified selector.

You can give a function which will expose the current object at a selector and a store which should return an object with properties to update.

```js
    const [currentImage, {update}] = useSelect(s=>s.currentImage);
    const markFavorite = () => {
        update((currentImage, globalStore) => {
            return { favorite: true }
        })
    }
```

### updateArray

```js
    const [images, {updateArray}] = useSelect(s=>s.images);
    const setInitialImages = () => {
        updateArray([{id:1, username:'foo'}, {id:2, username:'bar'}, {id:3, username:'was'}])
    }
```

Update array will clear out the existing array returned from the selector and populate it with given values.  Like with `update` you can give it a function which will expose existing array returned from the selector and a global store which should return an array with entries that should be in that array.

### add

```js
    const [images, {add}] = useSelect(s=>s.images);
    const addNewImages = (images) => {
        add(...images)
    }
```

Add will call a `push` method on an array at a selector.

This operation does not take a function.

### remove

```js
    const [images, {remove}] = useSelect(s=>s.images);
    const deleteImage = (imageId) => {
        remove(v=>v.id===imageId)
    }
```

Remove will remove all matched objects which matched the matcher function passed into the operation from an object at a selector.

This operation does not take a function.

### splice

```js
    const [images, {splice}] = useSelect(s=>s.images);
    const reorderImages = () => {
        splice(0, 1, {id:9, username:'sexy kitten'})
    }
```

Splice will call a splice method on an array at a selector.  I honestly don't know why i have this :D

This operator does not take a function.

### setProp

```js
    const [currentImage, {setProp}] = useSelect(s=>s.currentImage);
    const markFavorite = () => {
        setProp('favorite', true);
    }
```

Set prop will update one single property on an object at a selector.

This operator does not take a function.

### deleteProp

```js
    const [currentImage, {deleteProp}] = useSelect(s=>s.currentImage);
    const clearFavorite = () => {
        deleteProp('favorite');
    }
```

Delete prop will delete a property from an object at a selector;


## useCom

```js
    const communications = useCom()
```

This hook will expose communications object used to send messages or audit the state.

### on

```js
    const {on} = useCom();
    const [,{updateArray}]=>useSelect(v=>v.images)

    on('load-images', (imageType, date)=> {
        db.getImages(imageType).then(updateArray);
    })
```

On will register a global message listener and execute a process when that listener is detected.

### send

```js
    const {send} = useCom();

    useEffect(()=> {
        send('init-images', 'FAVORITE_IMAGES');
    })
```

Send will dispatch a global message to a listener registered by using an `on` communication.

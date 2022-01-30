
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key) {
      console.log('get', key);
      // 依赖收集，此时依赖的回调函数已经被放推入了effectStack
      track(target, key);
      // 当某个被访问了，那么我们就去递归这个值下面的所有的key，看是否是对象，是的话需要递归的做响应式处理
      // 这个过程是个懒处理，如果某个值一直不被访问，我们就不会处理它了
      return typeof target[key] === 'object' ? reactive(target[key]) : target[key]
      // return target[key]
    },
    set(target, key, val) {
      target[key] = val
      // notify
      // notify should after this value change, so we can saw the new value
      console.log('set', key);
      trigger(target,key);
    },
    deleteProperty(target, key) {
      delete target[key]
      // notify
      console.log('deleteProperty', key);
      trigger(target,key);
    }
  })
}

// 临时存储副作用函数
const effectStack = [];
// 1.依赖收集函数：包装fn，立即执行fn，返回包装结果
function effect(fn) {
  const e = createReactiveEffect(fn);
  e()
  return e;
}

function createReactiveEffect(fn) {
  const effect = function() {
    try {
      effectStack.push(fn)
      return fn() // 这里执行回调，就出触发该回调依赖的所有的getter，然后去做依赖收集
    } finally {
      effectStack.pop()
    }
  }
  return effect
}

// 统一的依赖管理，管理每一个target它的下面的key对应的依赖deps
const targetMap = new WeakMap();

// 依赖收集：建立target/key和fn之间的映射关系
function track(target, key) {
  // 1. 获取当前的副作用函数，就是effect传入的那个回调函数
  const effect = effectStack[effectStack.length -1];
  if(effect){
    // 2.取出target/key对应的map
    let depMap = targetMap.get(target);
    // 如果这个对象还没人依赖过，那么就给它创建一个依赖收集器
    if(!depMap){
      depMap = new Map();
      targetMap.set(target, depMap);
    }

    // 3.获取key对应的set
    let deps = depMap.get(key);
    // 如果这个值还没有人依赖，那么就给它创建deps依赖收集器
    if(!deps){
      deps = new Set()
      depMap.set(key, deps);
    }

    // 4.存入set
    deps.add(effect);
  }
}

// 触发更新：当某个响应式数据发生变更，根据target、key获取对应的fn并执行他们
function trigger(target, key) {
  // 1.获取target/key对应的set，并遍历执行他们
  const depMap = targetMap.get(target);

  if(depMap){
    const deps = depMap.get(key);

    if(deps){
      deps.forEach(dep => dep());
    }
  }
}

const state = reactive({
  foo: 'foo',
  // proxy里面其实也只能拦截第一层个，比如这里bar下面的barz的访问和修改就拦截不到了
  bar: {
    barz:'barz'
  }
})


// state.foo
// state.foo = 'foooooo'
// delete state.foo
// state.bar = 'bar'
// state.bar


// 这里能看到也只能拦截到bar的访问，并拦截不到barz的访问和修改
// state.bar.barz = '123'


// 上面get里面做过递归处理之后情况就不一样了 
// return typeof target[key] === 'object' ? reactive(target[key]) : target[key]
// 这里我们访问了state.bar触发了bar的get，然后会去递归的执行reactive，然后我们又会触发state.bar.barz也就是barz的get
// 刚才递归处理过了，所有这时候barz就也能正常拦截了
// state.bar.barz = '234'



// 由于上面递归处理，这里的赋值哪怕直接赋值对应也没问题
// state.bar = {
//   fun:'222'
// }
// 因为在读取fun的时候，会先触发bar的get，给bar下面的所有属性处理成响应式的，再触发fun的get
// state.bar.fun


// 完全新添加属性，也没有任何问题
// state.aaa = {
//   ffooo:'bbb'
// }

// state.aaa.ffooo

effect(() => {
  console.log('effect1', state.foo);
  // 为什么effectStack是个数组，因为向下面这样，用户有可能会嵌套使用effect
  // 如果嵌套使用effect，相当于effect在执行它的回调fn的过程中，又有effect被调用，此时effectStack还没有pop就又push了
  // 那么当我们内层的这个effect去读取数组的时候，它找依赖函数的时候，肯定是去effectStack最上层找
  // 这也就是为什么effectStack要被设计成一个数组，其实它看似数据，实则是栈的理念
  // effect(() => {})
})

// effect(() => {
//   console.log('effect2', state.foo, state.bar.barz)
// })


// 经过上面effect建立了依赖关系之后
// 我们这里修改foo的值，会触发set方法，并trigger该target的这个key的所有依赖去更新
// state.foo = '2323'

state.aaa = {a:1}



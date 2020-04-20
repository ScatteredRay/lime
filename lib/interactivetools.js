function Apropos(obj, expr) {
    return Object.keys(obj).filter(function(str){return expr.test(str)})
}

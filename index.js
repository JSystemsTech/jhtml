var _ = require('underscore'),
    fs = require('fs');
var tagsTypesThatDoNotNeedClosingTag = [
    'area',
    'base',
    'br',
    'col',
    'command',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source'
];
var REGISTERED_TEMPLATES = {};
/**
 *   Register a template available for use 
 * @param  {String} title
 * @param  {Function} templateFunction
 */
var registerTemplate = function(title, templateFunction) {
    if (_.isUndefined(REGISTERED_TEMPLATES[title])) {
        REGISTERED_TEMPLATES[title] = templateFunction;
    }
};
/**
 *   Get registered template
 * @param  {String} title
 * @param  {Object} params
 * @return {Object} || {String}
 */
var getTemplate = function(title, params) {
    if (!_.isUndefined(REGISTERED_TEMPLATES[title])) {
        return REGISTERED_TEMPLATES[title](params);
    }
    return '';
};
/**
 *   Check against list to see which tag format is necessary
 *   <{tag}/>
 *   Or 
 *   <{tag}><{/tag}
 * @param {String} tag
 * @return {Boolean}
 */
var useClosingTag = function(tag) {
    var needClosingTag = true;
    _.each(tagsTypesThatDoNotNeedClosingTag, function(listedTag) {
        if (listedTag === tag) {
            needClosingTag = false;
        }
    });
    return needClosingTag;
};
/**
 *   Check for attrs attribute as alias for properties attribute
 * @param {Object} jhtmlObj
 * @return {Object} 
 */
var getAttributesAlias = function(jhtmlObj) {
    if (!_.isUndefined(jhtmlObj.properties)) {
        return jhtmlObj;
    } else if (!_.isUndefined(jhtmlObj.attrs)) {
        jhtmlObj.properties = jhtmlObj.attrs;
    }
    return jhtmlObj;
};
/**
 *   Check to see if functions need to be run to generate tag, property, and body values
 * @param {Object} jhtmlObj
 * @return {String} 
 */
var preCompileObject = function(jhtmlObj) {
    jhtmlObj = getAttributesAlias(jhtmlObj);
    if (_.isString(jhtmlObj)) {
        return jhtmlObj;
    }
    if (!_.isUndefined(jhtmlObj.template) && !_.isUndefined(jhtmlObj.params)) {
        var jhtmlObjTemplate = getTemplate(jhtmlObj.template, jhtmlObj.params);
        return doCompile(jhtmlObjTemplate);
    }
    if (_.isUndefined(jhtmlObj.body)) {
        jhtmlObj.body = '';
    }
    var finalJhtmlObj = jhtmlObj;
    if (_.isFunction(jhtmlObj.tag)) {
        finalJhtmlObj.tag = jhtmlObj.tag();
    }
    if (_.isFunction(jhtmlObj.body)) {
        finalJhtmlObj.body = jhtmlObj.body();
    }
    if (!_.isUndefined(jhtmlObj.properties)) {
        if (_.isFunction(jhtmlObj.properties)) {
            finalJhtmlObj.properties = jhtmlObj.properties();
        }
        var keys = _.keys(jhtmlObj.properties);
        _.each(keys, function(key) {
            if (_.isFunction(jhtmlObj.properties[key])) {
                jhtmlObj.properties[key] = jhtmlObj.properties[key]();
            }
        });
    }
    if (_.isFunction(jhtmlObj.comment)) {
        finalJhtmlObj.comment = jhtmlObj.comment();
    }
    /* Make User input for HTML tag case insensitive */
    jhtmlObj.tag = jhtmlObj.tag.toLowerCase();
    return doCompile(finalJhtmlObj);
};
/**
 *   Generate the html tag and the content within 
 * @param {Object} jhtmlObj
 * @return {String}
 */
var doCompile = function(jhtmlObj) {
    var tagProperties = '';
    if (!_.isUndefined(jhtmlObj.properties)) {
        var keys = _.keys(jhtmlObj.properties);
        _.each(keys, function(key) {
            tagProperties = tagProperties + ' ' + key + '="' + jhtmlObj.properties[key] + '"';
        });
    }
    var body = jhtmlObj.body;
    var finalBody = body;
    if (!_.isString(body)) {
        finalBody = '';
        _.each(body, function(nextJhtmlObj) {
            finalBody = finalBody + preCompileObject(nextJhtmlObj);
        });
    }
    var template = '<' + jhtmlObj.tag + tagProperties;
    /* Handle html tag special case */
    if (jhtmlObj.tag === 'html') {
        template = '<!DOCTYPE html>' + template;
    }
    if (!_.isUndefined(jhtmlObj.comment)) {
        template = '<!--' + jhtmlObj.comment + '-->' + template;
    }
    if (useClosingTag(jhtmlObj.tag) === true) {
        template = template + '>' + finalBody + '</' + jhtmlObj.tag + '>';
    } else {
        template = template + '/>';
    }
    return template;
};
/**
 *   Require and compile html template from file
 * @param {String} sourcePath
 * @return {String}
 **/
var load = function(sourcePath) {
    var jhtmlObj = require(sourcePath);
    return preCompileObject(jhtmlObj);
};
/**
 *   Generate html file from provided template object or filepath
 * @param {String} destinationPath
 * @param {String} || {Object} pathOrObj
 * @param {Boolean} loadFromFile
 **/
var generateHtmlFile = function(destinationPath, pathOrObj, loadFromFile) {
    var compiledHtmlString;
    if (!_.isUndefined(loadFromFile) && _.isString(pathOrObj) && loadFromFile === true) {
        compiledHtmlString = load(pathOrObj);
    } else {
        compiledHtmlString = preCompileObject(pathOrObj);
    }

    fs.writeFile(destinationPath + '.html', compiledHtmlString, {
        flags: 'wx'
    }, function(err) {
        if (err) {
            throw err;
        }
    });
};
/**
 *   Generate html files in given directory from givem .js or .json template files in another directory
 * @param {String} sourceDirPath
 * @param {String} destinationDirPath
 **/
var generateHtmlTemplatesDir = function(sourceDirPath, destinationDirPath) {
    fs.readdir(sourceDirPath, function(err, files) {
        if (err) {
            throw err;
        }
        _.each(files, function(name) {
            var trimmedName = name.substr(0, name.lastIndexOf('.'));
            var fileExtention = name.substr(name.lastIndexOf('.'), name.length);
            if (fileExtention === '.js' || fileExtention === '.json') {
                generateHtmlFile(destinationDirPath + '/' + trimmedName, sourceDirPath + '/' + trimmedName, true);
            }

        });
    });
};
module.exports = {
    compile: preCompileObject,
    load: load,
    registerTemplate: registerTemplate,
    generateHtmlFile: generateHtmlFile,
    generateHtmlTemplatesDir: generateHtmlTemplatesDir
};
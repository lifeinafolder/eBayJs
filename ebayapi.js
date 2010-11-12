/**
 * The eBay Shopping/Finding API JavaScript Client
 * The client works by performing JSONP requests. The client also supports AJAX if JQuery is installled.
 * @author : Rajat Mittal
 * @version : 1.0
 * @param params[Object] - parameter object
 *      {
 *          appId (required): application id
 *          mode (optional) : request mode. One of the following two types ('AJAX', 'JSONP') [ Default : 'JSONP' ]
 *          url (optional) : base url . Only required when mode is AJAX. It substitutes the constant 
 *          SHOPPING_API/FINDING_API with the provided url.
 *      }
 */
function ebay( params ){
  if ( params.appId ){
    this.appId = params.appId;
    this._responseFormat = 'JSON';
    this.callback = params.callback;
    this.mode = params.mode || 'JSONP';
    if ( this.mode === 'AJAX' && params.url && params.url !== '' ){
      ebay.SHOPPING_API = params.url + '?callname=';
      ebay.FINDING_API = params.url + '?&SERVICE-VERSION=1.0.0&REST-PAYLOAD&OPERATION-NAME=';
    }
  }
}

ebay.SHOPPING_API = 'http://open.api.ebay.com/shopping?callname=';
ebay.FINDING_API = 'http://svcs.ebay.com/services/search/FindingService/v1?&SERVICE-VERSION=1.0.0&REST-PAYLOAD&OPERATION-NAME=';

/**
 * Utility function to generate linear unique numbers to supplement unique callbacknames, unique script sources
 * @return [number] - counter
 */
ebay._getCallId = (function(){
  var callId = 0;
  return function(){
    return callId++;
  }
})();

/**
 * Utility function to merge two objects
 * @param source[Object]-  Object to merge from
 * @param target[Object]-  Object to merge into
 * @return [Object] - final object composed after merging source object in the target object
 */
ebay._merge = function(source,target){
  for ( attrs in source) {
    if ( source.hasOwnProperty ( attrs ) ){   //dont navigate the prototype chain.
      target[attrs] = source[attrs];
    }
  }
  return target;
};

/**
 * Remove unneccesary fields from the response.
 * @param response[Object] - response object to cleanup
 */
ebay._cleanResponse = function(response){
  delete response.Ack;
  delete response.Build;
  delete response.Version;
  delete response.Timestamp;

  return response;
};

/**
 * Executes a particular call
 * @param contextObj - Object defining the call and its primary parameter
 * @param props[Object] - object holding additional request parameters
 * @param callback[Function] - Reference to callback fn to report the response of this call to. If not specified,
 *  the object's callback fn is called.
 */
ebay._execute = function(contextObj,props,callback){
  var queryObj = ebay._merge(props,contextObj);
  var query = this._buildQuery(queryObj);
  this._performQuery(query,callback);
};

/**
 * A modified curry function to allow partial functions inside the ebay client
 */
ebay._curry = function() {
  var args = Array.prototype.slice.call(arguments);
  var fn = args.shift();
  return function() {
    return fn.apply(this, args.concat(
      Array.prototype.slice.call(arguments)));
  };
};

/**
 * Creates a JSONP call
 * @param url- url to do the request at. The url should be ending with the query string param for JSONP
 *                        as defined by the  provider of the JSONP service.
 * @param callback[Function] - Reference to callback fn to report the response of this call to.
 */
ebay._getJSON = function(url,callback){
  var script = document.createElement('SCRIPT');
  var tempCallbackName = 'JSONP' + ebay._getCallId();
  script.src = url + tempCallbackName;
  window[tempCallbackName] = function(response){
    callback(response);
    delete window[tempCallbackName];
    script.parentNode.removeChild(script);
  };
  document.getElementsByTagName('HEAD')[0].appendChild(script);
};

/**
 * Constructs a complete URL for making a GET request
 * props[Object] - property object
 *    {
 *        callName - name of the actual ebay api call to make [REQUIRED]
 *        All call specific parameters
 *    }
 */
ebay.prototype._buildQuery = function(props){
  function adder(){
    delete props.callName;
    var urlSuffix = '';
    for( var key in props ){
      if ( props.hasOwnProperty(key) ){
        urlSuffix += '&' + key + '=' + props[key];
      }
    }
    return urlSuffix;
  }
  if ( props.callName ){
    if ( props.type === 'FINDING' ){
      var url = ebay.FINDING_API + props.callName + '&SECURITY-APPNAME=' + this.appId + '&RESPONSE-DATA-FORMAT=' + this._responseFormat;
      url = url + adder() + '&callback=';
    }
    else{
      var url = ebay.SHOPPING_API + props.callName + '&appid=' + this.appId + '&version=525' +  '&responseencoding=' + this._responseFormat;
      url = url + adder() + '&callbackname=';
    }
    return url;
  }
  return false;
};

/**
 * Do the actual query
 * @param query - URL
 * @callback - call specific callback fn. If not provided, than the callback function attached to the ebay object is used
 */
ebay.prototype._performQuery = function(query,callback){
  var self = this;
  if ( self.mode === 'AJAX' ){
    jQuery.ajax({
      url : query,
      success: function(response){
        callback = callback || self.callback;
        callback( ebay._cleanResponse(response) );
      }
    });
  }
  else{
    ebay._getJSON(query, function(response){
      if ( callback ) {
        callback( ebay._cleanResponse(response) );
      }
      else if ( self.callback ){
        self.callback( ebay._cleanResponse(response) );
      }
    });
  }
};

/**
 * Get User Profiles
 * @param userIds[Array] - Array of ids of the users
 * @param props[Object] - object holding additional request parameters ( so called IncludeSelectors )
 * @param callback[Function] - Reference to callback fn to report this response to. If not specified,
 *  the object's callback fn is called.
 */
ebay.prototype.getUsers = function(userIds,props,callback){
  var noOfUsers = userIds.length;
  if ( noOfUsers > 1 ){
    var finalResponse = [];
    var callbackCount = 0;
    var self = this;
    var callbackIdentifier = '_tempCallback' + ebay._getCallId();
    this[callbackIdentifier] = function(insertAt,response){
      finalResponse[insertAt] = response;
      callbackCount++;
      if( callbackCount === noOfUsers ){
        var callback = callback || self.callback;
        delete self[callbackIdentifier];
        callback(finalResponse);
      }
    };
    
    var position = 0;
    while( userIds.length !== 0 ){
      this.getUsers([userIds[0]],props,ebay._curry(this[callbackIdentifier],position));
      userIds.shift();
      position++;
    }
  }
  else{
    ebay._execute.call(this,{
      callName : 'GetUserProfile',
      'UserID' : userIds[0]
    },props,callback);
  }
};

/**
 * Get Categories
 * @param categoryIds[Array] - Array of ids of the categories
 * @param props[Object] - object holding additional request parameters ( so called IncludeSelectors )
 * @param callback[Function] - Reference to callback fn to report this response to. If not specified,
 *  the object's callback fn is called.
 */
ebay.prototype.getCategory = function(categoryIds,props,callback){
  var noOfCategories = categoryIds.length;
  if ( noOfCategories > 1 ){
    var finalResponse = [];
    var callbackCount = 0;
    var self = this;
    var callbackIdentifier = '_tempCallback' + ebay._getCallId();
    this[callbackIdentifier] = function(insertAt,response){
      finalResponse[insertAt] = response;
      callbackCount++;
      if( callbackCount === noOfCategories ){
        var callback = callback || self.callback;
        delete self[callbackIdentifier];
        callback(finalResponse);
      }
    };

    var position = 0;
    while( categoryIds.length !== 0 ){
      this.getCategory([categoryIds[0]],props,ebay._curry(this[callbackIdentifier],position));
      categoryIds.shift();
      position++;
    }
  }
  else{
    ebay._execute.call(this,{
      callName : 'GetCategoryInfo',
      CategoryID : categoryIds[0]
    },props,callback);
  }
};

/**
 * Get Items
 * @param items[Array] - Array of item ids
 * @param props[Object] - object holding additional request parameters ( so called IncludeSelectors )
 * @param callback[Function] - Reference to callback fn to report this response to. If not specified,
 *  the object's callback fn is called.
 */
ebay.prototype.getItems = function(items,props,callback){
  var multipleItems = (items.length === 1)? false : true;
  if( multipleItems ){
    //make getMultipleItems call
    var contextObj = {
      callName : 'GetMultipleItems',
      'ItemID' : items.join()
    };
  }
  else{
    //make getSingleItem call
    var contextObj = {
      callName : 'GetSingleItem',
      'ItemID' : items[0]
    };
  }
  ebay._execute.call(this,contextObj,props,callback);
};

/**
 * Get Popular Items
 * @param keywords[String] - list of keywords separated by space
 * @param props[Object] - object holding additional request parameters
 * @param callback[Function] - Reference to callback fn to report this response to. If not specified,
 *  the object's callback fn is called.
 */
ebay.prototype.getPopularItems = function(keywords,props,callback){
  ebay._execute.call(this,{
    callName : 'FindPopularItems',
    'QueryKeywords' : keywords
  },props,callback);
};

/**
 * Get Search Items from the FINDING API based upon Keywords
 * @param keywords[String] - list of keywords separated by space
 * @param props[Object] - object holding additional request parameters
 * @param callback[Function] - Reference to callback fn to report this response to. If not specified,
 *  the object's callback fn is called.
 */
ebay.prototype.searchByKeywords = function(keywords,props,callback){
  ebay._execute.call(this,{
    callName : 'findItemsByKeywords',
    'keywords' : keywords,
    type : 'FINDING'
  },props,callback);
};

/**
 * Get Items Listings in a particular category from the FINDING API
 * @param categoryId[String] - categoryId
 * @param props[Object] - object holding additional request parameters
 * @param callback[Function] - Reference to callback fn to report this response to. If not specified,
 *  the object's callback fn is called.
 */
ebay.prototype.getItemsInCategory = function(categoryId,props,callback){
  ebay._execute.call(this,{
    callName : 'findItemsByCategory',
    'categoryId' : categoryId,
    type : 'FINDING'
  },props,callback);
};

/**
 * Get Product info
 * @param keywords[String] - keywords for the item
 * @param props[Object] - object holding additional request parameters
 * @param callback[Function] - Reference to callback fn to report this response to. If not specified,
 *  the object's callback fn is called.
 */
ebay.prototype.getProductInfo = function(keywords,props,callback){
  ebay._execute.call(this,{
    callName : 'FindProducts',
    'QueryKeywords' : keywords
  },props,callback);
};
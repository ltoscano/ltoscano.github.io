function cancella_cookie(name) {
  var pathBits = location.pathname.split('/');
  var pathCurrent = ' path=';
  document.cookie = name + '=; expires=Thu, 01-Jan-1970 00:00:01 GMT;';
  // cancello per ogni possibile path
  for (var i = 0; i < pathBits.length; i++) {
    pathCurrent += ((pathCurrent.substr(-1) != '/') ? '/' : '') + pathBits[i];
    document.cookie = name + '=; expires=Thu, 01-Jan-1970 00:00:01 GMT;' + pathCurrent + ';';
  }
  // cancello anche i cookie settati a livello del dominio principale
  var domain;
  var host = location.hostname;
  var domain_array = host.split('.');
  var domain_parts = domain_array.length;
  if (domain_parts == 2) domain = host;
  else{
    domain = domain_array[domain_parts-2] + '.' + domain_array[domain_parts-1];
  }
  document.cookie = name + '=; expires=Thu, 01-Jan-1970 00:00:01 GMT; path=/; domain=' + domain;
}
function cancella_tutti_cookie(title) {
  if (document.cookie.length > 0) {
    var cookies = document.cookie.split(';');
    for(var i=0; i < cookies.length; i++) {
      var equals = cookies[i].indexOf('=');
      var name = equals > -1 ? cookies[i].substr(0, equals) : cookies[i];
      cancella_cookie(name);
    }
  }
  alert('I cookie di '+title+' sono stati cancellati');
}

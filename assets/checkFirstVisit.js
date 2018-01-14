function getCookie(name) {
  var value = "; " + document.cookie;
  var parts = value.split("; " + name + "=");
  if (parts.length == 2) return parts.pop().split(";").shift();
}

function deleteCookie(name) {
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

function checkIfFirstVisit() {
    var data=getCookie('cookiescriptaccept');
    if (data!='visit') deleteCookie('cookiescriptaccept');
}

checkIfFirstVisit();

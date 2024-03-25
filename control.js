/* Dali Clock - a melting digital clock written in JavaScript.
 * Copyright (c) 1991-2010 Jamie Zawinski <jwz@jwz.org>
 *
 * Permission to use, copy, modify, distribute, and sell this software and its
 * documentation for any purpose is hereby granted without fee, provided that
 * the above copyright notice appear in all copies and that both that
 * copyright notice and this permission notice appear in supporting
 * documentation.  No representations are made about the suitability of this
 * software for any purpose.  It is provided "as is" without express or
 * implied warranty.
 */

var clock;

function launch() {
  var bdiv   = document.getElementById ("clockbg");
  var canvas = document.getElementById ("canvas");
  if (clock) {
   clock.hide ();
  } else {
    clock = new DaliClock();
    clock.setup (canvas, bdiv, fonts);
  }
  upd();
  clock.show ();
}

var prefs;

function upd() {
  if (! prefs) prefs = new Object;
  prefs.width		= document.prefs_form.width.value;
  prefs.height		= document.prefs_form.height.value;
  prefs.time_mode	= document.prefs_form.time_mode.value;
  prefs.date_mode	= document.prefs_form.date_mode.value;
  prefs.twelve_hour_p	= document.prefs_form.twelve_p.value == 'true';
  prefs.fps		= document.prefs_form.fps.value;
  prefs.cps		= document.prefs_form.cps.value;
  prefs.orientation	= document.prefs_form.orientation.value;
  prefs.vp_scaling_p	= document.prefs_form.scaling.value == 'true';
  prefs.fps = parseInt(prefs.fps);
  prefs.cps = parseInt(prefs.cps);

  if (! prefs.width) { 
    prefs.width  = 0.95 * document.getElementById ("clockbg").offsetWidth;
    prefs.height = 0.95 * document.getElementById ("clockbg").offsetHeight;
  }

  clock.changeSettings (prefs);
}

function show_date() {
  prefs.show_date_p = true;
  clock.changeSettings (prefs);
  window.setTimeout (this.show_time.bind(this), 2000);
}

function show_time() {
  prefs.show_date_p = false;
  clock.changeSettings (prefs);
}

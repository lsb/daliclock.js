/* Dali Clock - a melting digital clock for Palm WebOS.
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

// Module API:
//  setup (canvas_element,		initialization
//         background_element,
//         fonts)
//  show ()				start animation timers
//  hide ()				stop animation timers
//  destroy ()				about to exit
//  changeSettings (settings)		change how clock is displayed
//
//  The settings object contains:
//
//    width		size of clock display area
//    height		size of clock display area
//    orientation	'up' | 'left' | 'right' | 'down'
//    time_mode		'HHMMSS' | 'HHMM' | 'SS'
//    date_mode		'MMDDYY' | 'DDMMYY' | 'YYMMDD'
//    twelve_hour_p	boolean, whether to display 12 or 24-hour time
//    show_date_p	boolean, whether to display date instead of time
//    fps		integer (frames per second)
//    cps		integer (color changes per second)
//    vp_scaling_p	whether canvas scaling works for antialiasing


function DaliClock() {
}

DaliClock.prototype.setup = function (canvas_element, background_element,
                                      fonts) {

  this.canvas  = canvas_element;
  this.clockbg = background_element;
  this.fonts   = fonts;
  this.shown_p = false;

  this.fg_hsv = [200, 0.4, 1.0];
  this.bg_hsv = [128, 1.0, 0.4];

  this.fg_hsv[0] += Math.floor(Math.random()*360);
  this.bg_hsv[0] += Math.floor(Math.random()*360);

  this.changeSettings(undefined);
}


// Change display settings at next second-tick.
//
DaliClock.prototype.changeSettings = function(settings) {

  var copy = new Object;
  for (var e in settings) { copy[e] = settings[e]; }
  this.new_settings = copy;

  // We can process these immediately
  if (settings) {
    this.clock_freq = settings.fps ? Math.round (1000 / settings.fps) : 0;
    this.color_freq = settings.cps ? Math.round (1000 / settings.cps) : 0;
  }

  if (this.clock_freq <= 0) this.clock_freq = 1;

  // If the clock is hidden, we can process everything immediately.
  if (!this.shown_p) this.settings_changed();
}


// Called at the start of each sequence if the new_settings object exists.
// All settings changes are delayed until the second-tick.
//
DaliClock.prototype.settings_changed = function() {

  // Changes to some settings require tearing down and rebuilding
  // the clock.  Changes to others can be animated normally.
  //
  var reset_p =
    (this.settings              == undefined ||
     this.settings.width        != this.new_settings.width  ||
     this.settings.height       != this.new_settings.height ||
     this.settings.time_mode    != this.new_settings.time_mode ||
     this.settings.orientation  != this.new_settings.orientation ||
     this.settings.vp_scaling_p != this.new_settings.vp_scaling_p);

  this.settings = this.new_settings;
  this.new_settings = undefined;

  if (reset_p) this.clock_reset();
}


// For setup tasks that have to happen each time the window becomes visible.
//
DaliClock.prototype.show = function() {

  if (this.shown_p) return;
  this.shown_p = true;

  // Start the color timer.
  this.color_timer_fn = this.color_timer.bind(this);
  this.color_timer_fn();

  // Start the clock timer.
  this.clock_timer_fn = this.clock_timer.bind(this);
  this.clock_timer_fn();


}


// Tasks that have to happen each time the window is hidden.
//
DaliClock.prototype.hide = function() {

  if (!this.shown_p) return;
  this.shown_p = false;

  if (this.clock_timer_id) {
    window.clearTimeout (this.clock_timer_id);
    this.clock_timer_id = undefined;
  }
  if (this.color_timer_id) {
    window.clearTimeout (this.color_timer_id);
    this.color_timer_id = undefined;
  }
}


// About to exit.
//
DaliClock.prototype.cleanup = function() {
  this.hide();
}


// Reset the animation when the settings (number of digits, orientation)
// has changed.  We have to start over since the resolution is different.
//
DaliClock.prototype.clock_reset = function() {

  this.pick_font_size();

  if (! this.font.empty_frame) {
    this.font.empty_frame = this.make_empty_frame (this.font, false);
    this.font.empty_colon = this.make_empty_frame (this.font, true);
  }

  this.orig_frames    = new Array(8);  // what was there
  this.orig_digits    = new Array(8);  // what was there
  this.current_frames = new Array(8);  // current intermediate animation
  this.target_frames  = new Array(8);  // where we are going
  this.target_digits  = new Array(8);  // where we are going

  for (var i = 0; i < this.current_frames.length; i++) {
    var colonic_p = (i == 2 || i == 5);
    var empty = (colonic_p ? this.font.empty_colon : this.font.empty_frame);
    this.orig_frames[i]    = empty;
    this.orig_digits[i]    = undefined;
    this.target_frames[i]  = empty;
    this.current_frames[i] = this.copy_frame (empty);
  }


  // Set the CSS orientation of the canvas based on the current orientation.
  // Webkit uses "webkitTransform".  Firefox 3.5 uses "MozTransform".
  // Maybe someday it will be just "transform".  We set them all...
  //
  var tr;
  switch (this.settings.orientation) {
    case 'left':  tr = 'rotate(90deg)' ; break;
    case 'right': tr = 'rotate(-90deg)'; break;
    case 'down':  tr = 'rotate(180deg)'; break;
    default:      tr = ''; break;
  }
  this.canvas.style.transform       = tr;
  this.canvas.style.webkitTransform = tr;
  this.canvas.style.MozTransform    = tr;


  // And now set the CSS position and size of the canvas
  // (not the same thing as size of the canvas's frame buffer).
  //
  var width  = this.canvas.width;   // size of the framebuffer
  var height = this.canvas.height;
  var nn, cc;

  switch (this.settings.time_mode) {
    case 'SS':   nn = 2; cc = 0; break;
    case 'HHMM': nn = 4; cc = 1; break;
    default:     nn = 6; cc = 2; break;
  }

  this.displayed_digits = nn + cc;

  if (this.settings.vp_scaling_p) {   // was doubled, for anti-aliasing
    // width  /= 2;
    // height /= 2;
    var r  = height / width;
    width  = Math.floor(this.settings.width);
    height = Math.floor(width * r);
  }

  x = (this.settings.width  - width)  / 2;
  y = (this.settings.height - height) / 2;

  this.ctx = this.canvas.getContext("2d");

  this.canvas.style.left   = x + 'px';
  this.canvas.style.top    = y + 'px';
  this.canvas.style.width  = width  + 'px';
  this.canvas.style.height = height + 'px';

}


// Gets the current wall clock and formats the display accordingly.
//
DaliClock.prototype.fill_target_digits = function(date) {

  var h = date.getHours();
  var m = date.getMinutes();
  var s = date.getSeconds();
  var D = date.getDate();
  var M = date.getMonth() + 1;
  var Y = date.getFullYear() % 100;

  if (this.settings.twelve_hour_p) {
    if (h > 12) { h -= 12; }
    else if (h == 0) { h = 12; }
  }

  for (var i = 0; i < this.target_digits.length; i++) {
    this.target_digits[i] = undefined;
  }

  if (this.settings.debug_digit != undefined) {
    if (this.settings.debug_digit < 0 ||
        this.settings.debug_digit > 11)
      this.settings.debug_digit = undefined;
    this.target_digits[0] = this.target_digits[1] = 
    this.target_digits[3] = this.target_digits[4] = 
    this.target_digits[6] = this.target_digits[7] = this.settings.debug_digit;
    this.settings.debug_digit = undefined;

  } else if (!this.settings.show_date_p) {

    switch (this.settings.time_mode) {
      case 'SS':
        this.target_digits[0] = Math.floor(s / 10);
        this.target_digits[1] =           (s % 10);
        break;
      case 'HHMM':
        this.target_digits[0] = Math.floor(h / 10);
        this.target_digits[1] =           (h % 10);
        this.target_digits[2] =		       10;  // colon
        this.target_digits[3] = Math.floor(m / 10);
        this.target_digits[4] =           (m % 10);
        if (this.settings.twelve_hour_p && this.target_digits[0] == 0) {
          this.target_digits[0] = undefined;
        }
        break;
      default:
        this.target_digits[0] = Math.floor(h / 10);
        this.target_digits[1] =           (h % 10);
        this.target_digits[2] =		       10;  // colon
        this.target_digits[3] = Math.floor(m / 10);
        this.target_digits[4] =           (m % 10);
        this.target_digits[5] =		       10;  // colon
        this.target_digits[6] = Math.floor(s / 10);
        this.target_digits[7] =           (s % 10);
        if (this.settings.twelve_hour_p && this.target_digits[0] == 0) {
          this.target_digits[0] = undefined;
        }
        break;
    }
  } else {  // date mode

    switch (this.settings.date_mode) {
      case 'MMDDYY':
        switch (this.settings.time_mode) {
          case 'SS':
            this.target_digits[0] = Math.floor(D / 10);
            this.target_digits[1] =           (D % 10);
            break;
          case 'HHMM':
            this.target_digits[0] = Math.floor(M / 10);
            this.target_digits[1] =           (M % 10);
            this.target_digits[2] =		   11;  // dash
            this.target_digits[3] = Math.floor(D / 10);
            this.target_digits[4] =           (D % 10);
            break;
          default:  // HHMMSS
            this.target_digits[0] = Math.floor(M / 10);
            this.target_digits[1] =           (M % 10);
            this.target_digits[2] =		   11;  // dash
            this.target_digits[3] = Math.floor(D / 10);
            this.target_digits[4] =           (D % 10);
            this.target_digits[5] =		   11;  // dash
            this.target_digits[6] = Math.floor(Y / 10);
            this.target_digits[7] =           (Y % 10);
            break;
        }
        break;
      case 'DDMMYY':
        switch (this.settings.time_mode) {
          case 'SS':
            this.target_digits[0] = Math.floor(D / 10);
            this.target_digits[1] =           (D % 10);
            break;
          case 'HHMM':
            this.target_digits[0] = Math.floor(D / 10);
            this.target_digits[1] =           (D % 10);
            this.target_digits[2] =		   11;  // dash
            this.target_digits[3] = Math.floor(M / 10);
            this.target_digits[4] =           (M % 10);
            break;
          default:  // HHMMSS
            this.target_digits[0] = Math.floor(D / 10);
            this.target_digits[1] =           (D % 10);
            this.target_digits[2] =		   11;  // dash
            this.target_digits[3] = Math.floor(M / 10);
            this.target_digits[4] =           (M % 10);
            this.target_digits[5] =		   11;  // dash
            this.target_digits[6] = Math.floor(Y / 10);
            this.target_digits[7] =           (Y % 10);
            break;
        }
        break;
      default:
        switch (this.settings.time_mode) {
          case 'SS':
            this.target_digits[0] = Math.floor(D / 10);
            this.target_digits[1] =           (D % 10);
            break;
          case 'HHMM':
            this.target_digits[0] = Math.floor(M / 10);
            this.target_digits[1] =           (M % 10);
            this.target_digits[2] =		   11;  // dash
            this.target_digits[3] = Math.floor(D / 10);
            this.target_digits[4] =           (D % 10);
            break;
          default:  // HHMMSS
            this.target_digits[0] = Math.floor(Y / 10);
            this.target_digits[1] =           (Y % 10);
            this.target_digits[2] =		   11;  // dash
            this.target_digits[3] = Math.floor(M / 10);
            this.target_digits[4] =           (M % 10);
            this.target_digits[5] =		   11;  // dash
            this.target_digits[6] = Math.floor(D / 10);
            this.target_digits[7] =           (D % 10);
            break;
        }
        break;
    }
  }
}


// Find the largest font that fits in the canvas given the current settings
// (number of digits and orientation).
//
DaliClock.prototype.pick_font_size = function() {

  var nn, cc;

  switch (this.settings.time_mode) {
    case 'SS':   nn = 2; cc = 0; break;
    case 'HHMM': nn = 4; cc = 1; break;
    default:     nn = 6; cc = 2; break;
  }

  var width  = this.settings.width;
  var height = this.settings.height;

  if (this.settings.vp_scaling_p) {   // double it, for anti-aliasing
    width  *= 2;
    height *= 2;
  }

  if (this.settings.orientation == 'left' || 
      this.settings.orientation == 'right') {
    var swap = width; width = height; height = swap;
  }

  for (var i = this.fonts.length-1; i >= 0; i--) {
    var font = this.fonts[i];
    var w = (font.char_width * nn) + (font.colon_width * cc);
    var h = font.char_height;

    if ((w <= width && h <= height) ||
        i == 0) {
      this.font          = font;
      this.canvas.width  = w;
      this.canvas.height = h;
      return;
    }
  }
}


DaliClock.prototype.make_empty_frame = function(font, colonic_p) {
  var cw = (colonic_p ? font.colon_width : font.char_width);
  var ch = font.char_height;
  var mid = Math.round(cw / 2);
  var frame = new Array(ch);
  for (var y = 0; y < ch; y++) {
    var line, seg;
    line = frame[y] = new Array(1);
    seg = line[0] = new Array(2);
    seg[0] = seg[1] = mid;
  }
  return frame;
}


DaliClock.prototype.copy_frame = function(oframe) {

  if (oframe == undefined) { return oframe; }
  var nframe = oframe.slice();   // copy array of lines
  var ch = nframe.length;
  for (var y = 0; y < ch; y++) {
    if (nframe[y]) { nframe[y] = nframe[y].slice(); }  // copy array of segs
    var segs = nframe[y].length;
    for (var x = 0; x < segs; x++) {
      if (nframe[y][x]) { nframe[y][x] = nframe[y][x].slice(); }  // copy segs
    }
    segs = nframe[y].length;
  }
  return nframe;
}


DaliClock.prototype.draw_frame = function(frame, x, y) {

  var ch = this.font.char_height;
  for (var py = 0; py < ch; py++)
    {
      var line  = frame[py];
      var nsegs = line.length;
      for (var px = 0; px < nsegs; px++)
        {
          var seg = line[px];
          this.ctx.fillRect (x + seg[0], y + py,
                             seg[1] - seg[0], 1);
        }
    }
}


// The second has ticked: we need a new set of digits to march toward.
//
DaliClock.prototype.start_sequence = function(date) {

  if (this.new_settings)
    this.settings_changed();

  // Move the (old) current_frames into the (new) orig_frames,
  // since that's what's on the screen now.
  //
  for (var i = 0; i < this.current_frames.length; i++) {
    this.orig_frames[i] = this.current_frames[i];
    this.orig_digits[i] = this.target_digits[i];
  }

  // generate new target_digits
  this.fill_target_digits (date);

  // Fill the (new) target_frames from the (new) target_digits.
  //
  for (var i = 0; i < this.target_frames.length; i++) {
    var colonic_p = (i == 2 || i == 5);
    var empty = (colonic_p ? this.font.empty_colon : this.font.empty_frame);
    var frame = (this.target_digits[i] == undefined
                 ? empty
                 : this.font.segments[this.target_digits[i]]);
    this.target_frames[i] = frame;
  }

  this.draw_clock ();
}


DaliClock.prototype.one_step = function(orig, curr, target, msecs) {

  var ch = this.font.char_height;
  var frac = msecs / 1000.0;

  for (var i = 0; i < ch; i++) {
    var oline = orig[i];
    var cline = curr[i];
    var tline = target[i];
    var osegs = oline.length;
    var tsegs = tline.length;
    var segs = (osegs > tsegs ? osegs : tsegs);

    // orig and target might have different numbers of segments.
    // current ends up with the maximal number.

    for (var j = 0; j < segs; j++) {
      var oseg = oline[j] || oline[0];
      var cseg = cline[j];
      var tseg = tline[j] || tline[0];

      if (! cseg) { cseg = cline[j] = new Array(2); }

      cseg[0] = oseg[0] + Math.round (frac * (tseg[0] - oseg[0]));
      cseg[1] = oseg[1] + Math.round (frac * (tseg[1] - oseg[1]));
    }
  }
}


// Compute the current animation state of each digit into target_frames
// according to our current position within the current wall-clock second.
//
DaliClock.prototype.tick_sequence = function() {

  var now   = new Date();
  var ctime = now.getTime();
  var secs  = Math.floor(ctime/1000);
  var msecs = ctime - (secs*1000);    // msec position within this second

  if (! this.last_secs) {
    this.last_secs = secs;   // fading in!
  } else if (secs != this.last_secs) {
    // End of the animation sequence; fill target_frames with the
    // digits of the current time.
    this.start_sequence (now);
    this.last_secs = secs;
  }

  // Linger for about 1/10th second at the end of each cycle.
  msecs *= 1.2;
  if (msecs > 1000) msecs = 1000;

  // Construct current_frames by interpolating between
  // orig_frames and target_frames.
  //
  for (var i = 0; i < this.orig_frames.length; i++) {
    this.one_step (this.orig_frames[i],
                   this.current_frames[i],
                   this.target_frames[i],
                   msecs);
  }

  this.current_msecs = msecs;
}


// left_offset is so that the clock can be centered in the window
// when the leftmost digit is hidden (in 12-hour mode when the hour
// is 1-9).  When the hour rolls over from 9 to 10, or from 12 to 1,
// we animate the transition to keep the digits centered.
//
DaliClock.prototype.compute_left_offset = function() {
  var left_offset;
  if (this.target_digits[0] == undefined &&	 // Fading in to no digit
      this.orig_digits[1] == undefined)
    left_offset = this.font.char_width / 2;
  else if (this.target_digits[0] != undefined && // Fading in to a digit
           this.orig_digits[1] == undefined)
    left_offset = 0;
  else if (this.orig_digits[0] != undefined &&	 // Fading out from digit
           this.target_digits[1] == undefined)
    left_offset = 0;
  else if (this.orig_digits[0] != undefined &&	 // Fading out from no digit
           this.target_digits[1] == undefined)
    left_offset = this.font.char_width / 2;
  else if (this.orig_digits[0] == undefined &&	 // Anim no digit to digit.
           this.target_digits[0] != undefined)
    left_offset = (this.font.char_width * (1000 - this.current_msecs) / 2000);
  else if (this.orig_digits[0] != undefined &&	 // Anim digit to no digit.
           this.target_digits[0] == undefined)
    left_offset = this.font.char_width * this.current_msecs / 2000;
  else if (this.target_digits[0] == undefined)	 // No anim, no digit.
    left_offset = this.font.char_width / 2;
  else						 // No anim, digit.
    left_offset = 0;
  return left_offset;
}


// Render the current animation state of each digit.
//
DaliClock.prototype.draw_clock = function() {

  var x = -this.compute_left_offset();
  var y = 0;
  this.ctx.clearRect (0, 0, this.canvas.width, this.canvas.height);

  for (var i = 0; i < this.displayed_digits; i++) {
    this.draw_frame (this.current_frames[i], x, y);
    var colonic_p = (i == 2 || i == 5);
    x += (colonic_p ? this.font.colon_width : this.font.char_width);
  }
}


DaliClock.prototype.clock_timer = function() {

  this.tick_sequence ();
  this.draw_clock ();

  // Re-trigger our timer.
  this.clock_timer_id = window.setTimeout (this.clock_timer_fn, 
                                           this.clock_freq);
}


DaliClock.prototype.tick_colors = function() {

  this.ctx.fillStyle = this.hsv_to_rgb (this.fg_hsv[0],
                                        this.fg_hsv[1],
                                        this.fg_hsv[2]);
  this.clockbg.style.backgroundColor = this.hsv_to_rgb (this.bg_hsv[0],
                                                        this.bg_hsv[1],
                                                        this.bg_hsv[2]);

  this.fg_hsv[0] += 1;
  if (this.fg_hsv[0] >= 360) { this.fg_hsv[0] -= 360; }

  this.bg_hsv[0] += 0.91;
  if (this.bg_hsv[0] >= 360) { this.bg_hsv[0] -= 360; }
}


DaliClock.prototype.color_timer = function() {

  // cps == 0 means don't cycle colors. but the timer still goes off
  // at least once a second in case cps has changed.

  var when = this.color_freq;
  if (when > 0)
    this.tick_colors();
  else
    when = 2000;

  this.color_timer_id = window.setTimeout(this.color_timer_fn, when);
}


// H is in the range 0 - 360;
// S and V are in the range 0.0 - 1.0.
// Returns string "rgb(255,255,255)"
//
DaliClock.prototype.hsv_to_rgb = function(h,s,v) {

  if (s < 0) s = 0;
  if (v < 0) v = 0;
  if (s > 1) s = 1;
  if (v > 1) v = 1;

  var S = s; 
  var V = v;
  var H = (h % 360) / 60.0;
  var i = Math.floor(H);
  var f = H - i;
  var p1 = V * (1 - S);
  var p2 = V * (1 - (S * f));
  var p3 = V * (1 - (S * (1 - f)));
  if	  (i == 0) { R = V;  G = p3; B = p1; }
  else if (i == 1) { R = p2; G = V;  B = p1; }
  else if (i == 2) { R = p1; G = V;  B = p3; }
  else if (i == 3) { R = p1; G = p2; B = V;  }
  else if (i == 4) { R = p3; G = p1; B = V;  }
  else		   { R = V;  G = p1; B = p2; }

  return ('rgb(' +
          Math.floor(R * 255) + ',' +
          Math.floor(G * 255) + ',' +
          Math.floor(B * 255) + ')');
}


DaliClock.prototype.LOG = function() {
  var logger = document.getElementById("log");
  if (logger) {
    var args = DaliClock.prototype.LOG.arguments;
    logger.firstChild.nodeValue = '';
    for (var i = 0; i < args.length; i++) {
      logger.firstChild.nodeValue += args[i] + ' ';
    }
  }
}


DaliClock.prototype.LOG2 = function() {
  var logger = document.getElementById("log");
  if (logger) {
    var args = DaliClock.prototype.LOG2.arguments;
    //logger.firstChild.nodeValue = '';
    for (var i = 0; i < args.length; i++) {
      logger.firstChild.nodeValue += args[i] + ' ';
    }
  }
}

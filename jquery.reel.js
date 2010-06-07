/**
          @@@@@@@@@@@@@@
      @@@@@@@@@@@@@@@@@@@@@@
    @@@@@@@@          @@@@@@@@
  @@@@@@@                @@@@@@@
 @@@@@@@                  @@@@@@@
 @@@@@@@                  @@@@@@@
 @@@@@@@@     @          @@@@@@@@
  @@@@@@@@@  @@@       @@@@@@@@@
   @@@@@@@@@@@@@@   @@@@@@@@@@@
     @@@@@@@@@@@@@    @@@@@@@
       @@@@@@@@@@@@     @@@
          @@@@@@
         @@@@
        @@
 *
 * jQuery Reel
 * ===========
 * 360° projection plugin for jQuery
 *
 * @license Copyright (c) 2009-2010 Petr Vostrel (http://petr.vostrel.cz/)
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * http://jquery.vostrel.cz/reel
 * Version: "Dancer" (will be 1.1 on release)
 * Updated: 2010-06-07
 *
 * Requires jQuery 1.4.x
 */
/*
 * Have it served by a cloud CDN:
 * - http://code.vostrel.cz/jquery.reel-bundle.js (recommended)
 * - http://code.vostrel.cz/jquery.reel.js
 * - http://code.vostrel.cz/jquery.reel-debug.js
 *
 * Optional nice-to-have plugins:
 * - jQuery.disableTextSelect [B] (James Dempster, http://www.jdempster.com/category/jquery/disabletextselect/)
 * - jQuery.mouseWheel [B] (Brandon Aaron, http://plugins.jquery.com/project/mousewheel)
 * - or jQuery.event.special.wheel (Three Dub Media, http://blog.threedubmedia.com/2008/08/eventspecialwheel.html)
 *
 * [B] Marked plugins are contained (with permissions) in the "bundle" version
 */

(function($){
  var
    defaults= {
      footage:            6, // number of frames per line/column
      frame:              1, // initial frame
      frames:            36, // total number of frames; every 10° for full rotation
      hint:              '', // hotspot hint tooltip
      horizontal:      true, // roll flow; defaults to horizontal
      hotspot:    undefined, // custom jQuery as a hotspot
      indicator:          0, // size of a visual indicator of reeling (in pixels)
      klass:             '', // plugin instance class name
      loops:           true, // is it a loop?
      reversed:       false, // true for "counter-clockwise sprite"
                             // (defaults to double the viewport size or half the `stitched` option)
      saves:          false, // [deprecated] whether allow user to save the image thumbnail
      sensitivity:       20, // interaction sensitivity
      spacing:            0, // space between frames on reel
      stitched:   undefined, // pixel width (length) of a stitched (rectilinear) panoramic reel
      suffix:       '-reel', // sprite filename suffix (A.jpg's sprite is A-reel.jpg by default)
      tooltip:           '', // [deprecated] use `hint` instead

      // [NEW] in version 1.1
      delay:             -1, // delay before autoplay in seconds (no autoplay by default)
      friction:         0.9, // friction of the inertial rotation (will loose 90% of speed per second)
      inertial:        true, // drag & throw will give the rotation a momentum when true
      monitor:    undefined, // stored value name to monitor in the upper left corner of the viewport
      rebound:          0.5,
      revolution: undefined, // distance mouse must be dragged for full revolution
      speed:              0, // animated rotation speed in revolutions per second (Hz)
      step:       undefined, // initial step (overrides `frame`)
      steps:      undefined, // number of steps a revolution is divided in (by default equal to `frames`)
      tempo:             25, // shared ticker tempo in ticks per second
      timeout:            2  // idle timeout in seconds
    }
    // [deprecated] options may be gone anytime soon

  $.fn.reel= function(options){
    var
      applicable= (function(tags){
        // Only IMG tags with non-empty SRC and non-zero WIDTH and HEIGHT will pass
        var
          pass= []
        tags.filter(_img_).each(function(ix){
          var
            $this= $(this),
            src= $this.attr(_src_),
            width= number($this.css(_width_)),
            height= number($this.css(_height_))
          if (!src || src == __ || !width || !height) return;
          pass.push($this);
        });
        tags.filter(_div_ + dot(klass)).each(function(ix){
          pass.push($(this));
        });
        return $(pass);
      })(this),
      set= $.extend({}, defaults, options),
      instances= []

    ticker= ticker || (function run_ticker(){
      return setInterval(function tick(){
        pool.trigger(tick_event);
      }, 1000 / set.tempo);
    })();

    applicable.each(function(){
      var
        t= $(this),

        // Data storage
        store= function(name, value){
          t.data(name, value);
          t.trigger('store');
          return value;
        },
        recall= function(name){
          t.trigger('recall')
          return t.data(name);
        },

        // Events & handlers
        on= {
          setup: function(){
            if (t.hasClass(klass)) return;
            var
              src= t.attr(_src_),
              id= t.attr(_id_),
              classes= t.attr(_class_),
              styles= t.attr('style'),
              image= src.replace(/^(.*)\.(jpg|jpeg|png|gif)$/, '$1' + set.suffix + '.$2'),
              size= { x: number(t.css(_width_)), y: number(t.css(_height_)) },
              turntable= $(_div_tag_).attr(_class_, classes).addClass(klass).addClass(set.klass),
              image_css= touchy || !set.saves ? { display: 'none' } : { opacity: 0 }
            instances.push((t= t.attr(_id_, __).wrap(turntable).css(image_css)
            .parent().attr(_id_, id).bind(on).css({
              display: 'block',
              width: size.x + _px_,
              height: size.y + _px_,
              backgroundImage: url(image)
            }))[0]);
            store(_frames_, set.frames);
            store(_spacing_, set.spacing);
            store(_dimensions_, size);
            store(_fraction_, 0);
            store(_steps_, set.steps || set.frames);
            store('resolution', max(set.steps, set.frames));
            store(_reversed_, set.speed < 0);
            store(_backup_, {
              id: id,
              'class': classes || __,
              style: styles || __
            });
            ticker && pool.bind(tick_event, on.tick);
            t.trigger('start');
          },
          teardown: function(e){
            t= t.unbind(on)
            .find(dot(indicator_klass) + ', ' + dot(monitor_klass)).remove().end()
            .find(_img_)
            .attr(t.data(_backup_)).unwrap()
            .bind('setup', function resetup(e){
              t.unbind('setup');
              on.setup();
            });
            ticker && pool.unbind(tick_event, on.tick);
          },
          start: function(e){
            t.css({ position: 'relative' });
            var
              hotspot= set.hotspot ? set.hotspot : t,
              space= recall(_dimensions_),
              frames= recall(_frames_),
              resolution= max(frames, recall(_steps_)),
              fraction= store(_fraction_, 1 / resolution * ((set.step || set.frame) - 1)),
              frame= store(_frame_, fraction * frames + 1)
            if (!touchy) hotspot
              .css({ cursor: 'ew-resize' })
              .mouseenter(function(e){ t.trigger('enter') })
              .mouseleave(function(e){ t.trigger('leave') })
              .mousemove(function(e){ t.trigger('over', [e.clientX, e.clientY]) })
              .mousewheel(function(e, delta){ t.trigger('wheel', [delta]); return false })
              .dblclick(function(e){ t.trigger('animate') })
              .mousedown(function(e){ t.trigger('down', [e.clientX, e.clientY]) })
              .disableTextSelect()
            else hotspot
              .each(function touch_support(){
                bind(this, {
                  touchstart: start,
                  touchmove: move,
                  touchend: end,
                  touchcancel: end
                });
                function bind(element, events){
                  $.each(events, function bind_handler(event){
                    element.addEventListener(event, this, false);
                  });
                }
                function prevent(event){
                  return event.cancelable && event.preventDefault() || false;
                }
                function start(event){
                  var
                    touch= event.touches[0]
                  t.trigger('down', [touch.clientX, touch.clientY, true])
                  return prevent(event);
                }
                function move(event){
                  var
                    touch= event.touches[0]
                  t.trigger('drag', [touch.clientX, touch.clientY, true]);
                  return prevent(event);
                }
                function end(event){
                  t.trigger('up', [true]);
                  return prevent(event);
                }
              });
            (set.hint || set.tooltip) && hotspot.attr(_title_, set.hint || set.tooltip);
            set.monitor && t.append($(_div_tag_, {
              className: monitor_klass,
              css: { position: _absolute_, left: 0, top: 0 }
            }));
            set.indicator && t.append($(_div_tag_)
              .addClass(indicator_klass)
              .css({
                width: set.indicator + _px_,
                height: set.indicator + _px_,
                top: (space.y - set.indicator) + _px_,
                position: _absolute_,
                backgroundColor: _hex_black_
              }));
            t.trigger('frameChange');
          },
          animate: function(e){
            // Stub for future compatibility
            // log(e.type);
          },
          tick: function(e){
            var
              speed= set.speed,
              friction= set.friction / set.tempo,
              velocity= recall(_velocity_),
              negative= velocity < 0,
              velocity= velocity - velocity * friction,
              velocity= last_velocity= velocity == last_velocity ? 0 : velocity
              velocity= (negative? min:max)(0, round_to(3, velocity)) || 0,
              velocity= store(_velocity_, velocity),
              step= (speed + velocity) / set.tempo
            $(dot(monitor_klass), t).text(recall(set.monitor));
            to_bias(0);
            idle && idle++;
            if (idle && !velocity) return;
            if (recall(_clicked_)) return unidle();
            var
              fraction= store(_fraction_, recall(_fraction_) + step)
            t.trigger('fractionChange');
          },
          down: function(e, x, y, touched){
            unidle();
            var
              clicked= store(_clicked_, true),
              location= store(_clicked_location_, x),
              velocity= store(_velocity_, 0),
              frame= store(_last_fraction_, store(_clicked_on_, recall(_fraction_)))
            !touched && pool
            .mousemove(function(e){ t.trigger('drag', [e.clientX, e.clientY]) })
            .mouseup(function(e){ t.trigger('up') });
          },
          up: function(e, touched){
            var
              clicked= store(_clicked_, false),
              pitch= bias[1] + bias[2] != 0,
              damper= touched ? 5 : 20,
              momentum= (bias[0] + bias[1] + bias[2]) / bias.length / damper,
              velocity= store(_velocity_, set.inertial && pitch ? (set.stitched ? -momentum : momentum) : 0)
            no_bias();
            idle= 0;
            !touched && pool.unbind('mousemove mouseup');
          },
          drag: function(e, x, y, touched){
            unidle();
            var
              origin= recall(_clicked_location_),
              fraction= recall(_clicked_on_),
              stitched= set.stitched,
              space= recall(_dimensions_),
              revolution= set.revolution || stitched / 2 || space.x,
              // sensitivity= touchy? set.sensitivity * 0.6 : set.sensitivity,
              distance= (x - origin), // / sensitivity,
              reverse= (set.reversed ? -1 : 1) * (stitched ? -1 : 1),
              shift= fraction + reverse / revolution * distance,
              fraction= store(_fraction_, shift)
            to_bias(x - last_x);
            last_x= x;
            t.trigger('fractionChange');
          },
          wheel: function(e, distance){
            unidle();
            var
              velocity= store(_velocity_, 0),
              fraction= recall(_fraction_),
              resolution= max(recall(_frames_), recall(_steps_)),
              step= 1 / resolution,
              delta= ceil(sqrt(abs(distance)) / 2),
              delta= distance < 0 ? -delta : delta,
              fraction= store(_fraction_, fraction + delta * step)
            t.trigger('fractionChange');
            return false;
          },
          fractionChange: function(e, fraction){
            var
              fraction= !fraction ? recall(_fraction_) : store(_fraction_, fraction),
              last_fraction= recall(_last_fraction_),
              delta= fraction - last_fraction,
              speed= set.speed= sign_like(delta, set.speed),
              // Looping
              fraction= set.loops ? fraction - (fraction<0? ceil:floor)(fraction) : min_max(0, 1, fraction),
              // Rebounce
              bounce= !set.loops && set.rebound && on_edge == set.rebound * 1000 / set.tempo,
              speed= set.speed= bounce ? -speed : speed,
              // Turn negative into positive
              fraction= !set.loops ? fraction : (fraction >= 0 ? fraction : 1 + fraction),
              fraction= store(_last_fraction_, store(_fraction_, round_to(6, fraction))),
              frame= store(_frame_, fraction * (recall(_frames_) - 1) + 1)
            !idle && (on_edge= fraction == 0 || fraction == 1 ? on_edge + 1 : 0);
            t.trigger('frameChange');
          },
          frameChange: function(e, frame){
            var
              frames= recall(_frames_),
              fraction= !frame ? recall(_fraction_) : store(_fraction_, round_to(6, (frame-1) / (frames-1))),
              frame= !frame ? recall(_frame_) : store(_frame_, frame),
              frame= store(_frame_, round(frame)),
              space= recall(_dimensions_),
              steps= recall(_steps_),
              spacing= recall(_spacing_),
              reversed= recall(_reversed_)
            if (!set.stitched){
              var
                major= floor(frame / set.footage),
                minor= frame - major * set.footage - 1,
                major= minor == -1 ? major + minor : major,
                minor= minor == -1 ? set.footage + minor : minor,
                // Count new positions
                major_size= set.horizontal ? space.y : space.x,
                minor_size= set.horizontal ? space.x : space.y,
                x= - major * (spacing + major_size),
                y= - minor * (spacing + minor_size),
                rows= ceil(frames / set.footage),
                // Count additional shift when rolling reverse direction
                reverse_shift= rows * major_size + (rows - 1) * spacing,
                x= reversed && set.horizontal ? x - reverse_shift : x,
                y= reversed && !set.horizontal ? y - reverse_shift : y,
                shift= set.horizontal ? [y + _px_, x + _px_] : [x + _px_, y + _px_]
            }else{
              var
                travel= set.loops ? set.stitched : set.stitched - space.x,
                x= round(fraction * travel),
                y= 0,
                shift= [-x + _px_, y + _px_]
            }
            var
              travel= space.x - set.indicator,
              indicator= min_max(0, travel, round(fraction * (travel+2)) - 1)
            t.css({ backgroundPosition: shift.join(' ') })
              .find(dot(indicator_klass)).css({ left: indicator + _px_ });
          }
        },

        // User idle control
        idle= set.delay > 0 ? -round(set.delay * set.tempo) : 0,
        unidle= function(){ return idle= -set.timeout * set.tempo },

        // Inertial rotation control
        on_edge= 0,
        last_x= 0,
        last_velocity= 0,
        to_bias= function(value){ bias.push(value) && bias.shift() },
        no_bias= function(){ return bias= [0,0,0] },
        bias= no_bias()

      t.ready(on.setup);
    });
    return $(instances);
  }

  // Double plugin functions in case plugin is missing
  double_for('mousewheel disableTextSelect'.split(/ /));

  // PRIVATE
  var
    ns= '.reel',
    klass= 'jquery-reel',
    indicator_klass= 'indicator',
    monitor_klass= 'monitor',
    tick_event= 'tick'+ns,
    pool= $(document),
    touchy= (/iphone|ipod|ipad|android/i).test(navigator.userAgent),
    ticker,

    // Shortcuts
    round= Math.round, floor= Math.floor, ceil= Math.ceil,
    min= Math.min, max= Math.max, abs= Math.abs, sqrt= Math.sqrt,
    number= parseInt,

    // Storage keys
    _backup_= 'backup', _clicked_= 'clicked', _clicked_location_= 'clicked_location',
    _clicked_on_= 'clicked_on', _dimensions_= 'dimensions', _fraction_= 'fraction', _frame_= 'frame',
    _frames_= 'frames', _last_fraction_= 'last_fraction', _reversed_= 'reversed', _spacing_= 'spacing',
    _steps_= 'steps', _velocity_= 'velocity',

    // Various string primitives
    __= '', _absolute_= 'absolute', _class_= 'class', _div_= 'div', _div_tag_= '<'+ _div_ + '/>',
    _height_= 'height', _hex_black_= '#000', _id_= 'id', _img_= 'img', _px_= 'px', _src_= 'src',
    _title_= 'title', _width_= 'width'

  function dot(string){ return '.' + string }
  function url(location){ return 'url(' + location + ')' }
  function round_to(decimals, number){ return +number.toFixed(decimals) }
  function min_max(minimum, maximum, number){ return max(minimum, min(maximum, number)) }
  function sign_like(specimen, value){ return (specimen * value > 0) ? value : -value }
  function double_for(methods){ $.each(methods, pretend);
    function pretend(){ if (!$.fn[this]) $.fn[this]= function(){ return this }}
  }
})(jQuery);

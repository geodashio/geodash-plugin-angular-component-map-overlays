declare var extract: any;
declare var geodash: any;
declare var $: any;

/* Core */
import { Component, OnInit, EventEmitter, ElementRef, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';

/* Services */
import { GeoDashServiceBus }  from 'GeoDashServiceBus';
import { GeoDashServiceCompile } from 'GeoDashServiceCompile';

/* Pipes */
import { GeoDashPipeSlugify }  from 'GeoDashPipeSlugify';

@Component({
  selector: 'geodash-map-overlays',
  template: geodash.api.getTemplate('geodashMapOverlays.tpl.html'),
  providers: [
    GeoDashPipeSlugify
  ]
})
export class GeoDashComponentMapOverlays implements OnInit {

  private dashboard: any;
  private state: any;
  private overlays: any;

  name = 'GeoDashComponentMapOverlays';

  constructor(private element: ElementRef, private changeDetector: ChangeDetectorRef, private sanitizer: DomSanitizer, private bus: GeoDashServiceBus, private compileService: GeoDashServiceCompile, private slugify: GeoDashPipeSlugify) {

    this.dashboard = undefined;
    this.state = {};
    this.overlays = [];
  }

  ngOnInit(): void {
    geodash.var.components[this.name] = this; // register externally
    this.bus.listen("primary", "geodash:loaded", this.onLoaded);
    this.bus.listen("render", "geodash:refresh", this.onRefresh);
  }

  //onLoaded(data: any, source: any): void {
  onLoaded = (name: any, data: any, source: any): void => {
    console.log("GeoDashComponentMapOverlays: ", data, source);
    this.dashboard = data["dashboard"];
    this.state = data["state"];

    this.overlays = extract("overlays", this.dashboard, []).map((overlay: any): any => geodash.util.extend(overlay, <any>{
        "classes": this.class_overlay(overlay),
        "style":  this.style_overlay(overlay, this.state),
        "intents":  this.build_intents(overlay),
        "src": this.imageURL(overlay),
        "link_url_template": extract("link.url", overlay),
        "link_target": extract("link.target", overlay),
        "link": this.build_link(
          overlay,
          extract("link.url", overlay),
          extract("link.target", overlay),
          this.dashboard,
          this.state
        ),
        "text_content_template": extract("text.content", overlay),
        "text_font": extract("text.font", overlay),
        "text_content": this.build_text(extract("text.content", overlay), this.dashboard, this.state)
    }));

    console.log("overlays =", this.overlays);
    setTimeout((function(element){
      return function() {
        $('[data-toggle="tooltip"]', element).tooltip();
      };
    })(this.element.nativeElement), 0);
  }

  onRefresh = (name: any, data: any, source: any): void => {
    this.state = data["state"];
    var changed = false;
    for(var i = 0; i < this.overlays.length; i++)
    {
      var before_style = JSON.stringify(this.overlays[i]['style']);
      var before_link = JSON.stringify(this.overlays[i]['link']);
      var before_text = JSON.stringify(this.overlays[i]['text_content']);
      this.overlays[i]['style'] = this.style_overlay(this.overlays[i], this.state);
      this.overlays[i]['link'] = this.build_link(
        this.overlays[i],
        extract("link_url_template", this.overlays[i]),
        extract("link_template", this.overlays[i]),
        this.dashboard,
        this.state);
      var text_content_template = extract("text_content_template", this.overlays[i]);
      if(geodash.util.isDefined(text_content_template))
      {
        this.overlays[i]["text_content"] = this.build_text(
          text_content_template,
          this.dashboard,
          this.state);
      }
      if(
        before_style != JSON.stringify(this.overlays[i]['style']) ||
        before_link != JSON.stringify(this.overlays[i]['link']) ||
        before_text != JSON.stringify(this.overlays[i]['text_content'])
      )
      {
        changed = true;
      }
    }
    if(changed)
    {
      this.changeDetector.detectChanges();
    }
  }

  onClickOverlay = (event: any, overlay: any): void => {
    var link = extract("link", overlay);
    if(! geodash.util.isDefined(link))
    {
      var intents = extract("intents", overlay, []);
      if(geodash.util.isDefined(intents))
      {
        intents.forEach((intent:any) => {
          var intentData = this.render(intent.data, <any>{"overlay": overlay});
          this.bus.emit("intents", intent.name, intentData, this.name);
        });
      }
      event.preventDefault();
    }
  }

  render = (object: any, ctx: any): any => {
    return geodash.util.arrayToObject(geodash.util.objectToArray(object).map((x:any) => {
      return <any>{
        "name": x.name,
        "value": (geodash.util.isString(x.value) ? this.interpolate(x.value)(ctx) : x.value)
      };
    }));
  }

  interpolate = (template: string): any => {
      return (ctx:any) => this.compileService.compile(template, ctx);
  }

  imageURL(overlay: any): string {
    if(geodash.util.isString(extract("image.url", overlay)) && extract("image.url", overlay).length > 0)
    {
      return extract("image.url", overlay);
    }
    else if(geodash.util.isDefined(extract("image.asset", overlay)) && extract("image.asset", overlay).length > 0 )
    {
      return extract(["var", "assets", extract("image.asset", overlay), "url"], geodash);
    }
    else
    {
      return "";
    }
  };

  class_overlay(overlay: any): string {
    var str = "geodash-map-overlay";
    if(geodash.util.isDefined(extract("intents", overlay)) || geodash.util.isDefined(extract("intent", overlay)))
    {
      str += " geodash-intent";
    }

    var classes = extract("css.classes", overlay);
    if(geodash.util.isDefined(classes))
    {
      if(geodash.util.isString(classes))
      {
        str += " " + classes;
      }
      else if(Array.isArray(classes))
      {
        str += " " + classes.join(" ");
      }
    }

    return str;
  };

  style_overlay(overlay: any, state: any): any {
    var styleMap = <any>{};

    geodash.util.extend(styleMap, <any>{
      "top": extract("position.top", overlay, 'auto'),
      "bottom": extract("position.bottom", overlay, 'auto'),
      "left": extract("position.left", overlay, 'auto'),
      "right": extract("position.right", overlay, 'auto'),
      "width": extract("width", overlay, 'initial'),
      "height": extract("height", overlay, 'initial'),
      "padding": "0px",
      "margin": "0px",
      "background": "transparent",
      "opacity": "1.0"
    });

    if(overlay.type == "text")
    {
      geodash.util.extend(styleMap, <any>{
        "font-family": extract("text.font.family", overlay, 'Arial'),
        "font-size": extract("text.font.size", overlay, '12px'),
        "font-style": extract("text.font.style", overlay, 'normal'),
        "text-shadow": extract("text.shadow", overlay, 'none')
      });
    }
    else if(overlay.type == "image")
    {
      geodash.util.extend(styleMap, <any>{
        "display": "inline-block"
      });
    }

    if(geodash.util.isDefined(extract("intents", overlay)) || geodash.util.isDefined(extract("intent", overlay)))
    {
      geodash.util.extend(styleMap, <any>{
        "cursor": "pointer"
      });
    }

    if(geodash.util.isDefined(extract("css.properties", overlay)))
    {
      geodash.util.extend(styleMap, geodash.util.arrayToObject(extract("css.properties", overlay)));
    }

    if(geodash.util.isDefined(state))
    {
      if(extract("view.overlays", state, []).indexOf(overlay.id) == -1)
      {
        styleMap["display"] = "none";
      }
    }
    else
    {
      styleMap["display"] = "none";
    }

    return styleMap;
  };

  build_intents(overlay: any): any {
    var data = [];
    var intents = extract("intents", overlay);
    if(Array.isArray(intents))
    {
      for(var i = 0; i < intents.length; i++)
      {
        var intent = intents[i];
        var intentName = intent.name;
        if(geodash.util.isDefined(intentName))
        {
          var intentProperties = intent.properties;
          if(geodash.util.isDefined(intentProperties))
          {
            var intentData = geodash.util.arrayToObject(intentProperties, <any>{'$interpolate': this.interpolate, 'ctx': <any>{'overlay': overlay}});
            data.push({ "name": intent.name, "data": intentData });
          }
          else
          {
            data.push({ "name": intent.name });
          }
        }
      }
    }
    return data;
  };

  build_link(overlay: any, link_url_template: any, link_target: any, dashboard: any, state: any): any {
    if(geodash.util.isDefined(link_url_template))
    {
      var link_url: SafeResourceUrl = undefined;
      var link_url_string = this.interpolate(link_url_template)({"dashboard": dashboard, "state": state});
      if(
        link_url_string.startsWith("http://") ||
        link_url_string.startsWith("https://") ||
        link_url_string.startsWith("sms:") ||
        link_url_string.startsWith("tel:") ||
        link_url_string.startsWith("mailto:")
      )
      {
        link_url = this.sanitizer.bypassSecurityTrustResourceUrl(link_url_string);
      }
      else
      {
        link_url = this.sanitizer.bypassSecurityTrustResourceUrl("http://"+link_url_string);
      }
      return {
        "url": link_url,
        "target": link_target || "_blank"
      }
    }
    else
    {
      return undefined;
    }
  };

  build_text(text_content_template: any, dashboard: any, state: any): any {
    if(geodash.util.isDefined(text_content_template))
    {
      return this.interpolate(text_content_template)({"dashboard": dashboard, "state": state});
    }
    else
    {
      return undefined;
    }
  };

}

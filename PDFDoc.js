"use strict";

var RowSection, TextSection, ColumnSection, PDFDocument, PDFSection, ImageSection;
//( function() {

    // A shared static variable
    var PDF = new jsPDF('portrait', 'pt', 'letter');

    // Convenience function to set properties in constructor
    function setProperties ( mappedVals ) {
        _.forEach ( _.keys( mappedVals ), function ( prop ) {
            this [ prop ] = mappedVals [ prop ];
        }.bind(this));
        return this;
    }


    /* PDF Section base constructor:
        A common class between the PDFSection classes and the Textwrapper class
    */
    function PDFBase (settings){
        this.initSettings = settings;
        this.baseClass  = PDFBase;  // This is overridden for the PDFSection classes, but not the TextWrapper
    }
    (function() {
        this.initialize = function(globalSettings){
            var s  = this.initSettings       || {};
            var gs = globalSettings || {};
            this.inheritedSettings = s.inheritedSettings || gs.inheritedSettings || {};
            if ( s.TextColor || gs.TextColor ){
                this.inheritedSettings.TextColor = s.TextColor || gs.TextColor;
                this.TextColor = s.TextColor || gs.TextColor;
            }
            if ( this.position || s.position ){
                this.position = new Dimensions( this.position || s.position );
            }
    
            return setProperties.call(this, {
                ignorePadding:            s.ignorePadding || gs.ignorePadding || false,
                fixedWidth  :             s.fixedWidth    || null,
                width       :             this.width      || s.width         || null,
                Font        :             s.Font          || gs.Font         || 'courier',
                FontSize    :             s.FontSize      || gs.FontSize     || 10,
                DrawColor   :             s.DrawColor     || gs.DrawColor    || [0, 0, 0],
                linePadding : new Offset (s.linePadding   || gs.linePadding  || { all: 0 } ),
                overflowAction : "split", 
            });
        };
        this.getStyles = function(){
            var styles = {};
            _.forEach(["DrawColor", "FillColor", "Font", "FontSize", "FontStyle",
                       "LineCap", "LineJoin", "LineWidth", "Properties", "TextColor"], 
                       function(style){
                         if( _.has(this, style) ){
                            styles["set"+style] = this[style];
                            if( !_.isArray(styles["set"+style])){
                                styles["set"+style] = [styles["set"+style]];
                            }
                         }
                       }.bind(this));
            return styles;
        };
        this.clone  = function(globalSettings){ 
            var instance = new this.constructor(this).setContent(this.content);
            if ( this.constructor === TextWrapper)
                return instance;
            if ( this.isPDFSection( this.Header) )
                instance.setHeader(this.Header);
            if ( this.isPDFSection( this.Footer) )
                instance.setFooter(this.Footer);
            if ( _.isUndefined(this.initSettings) ){
                instance.initialize(globalSettings || this.inheritedSettings);
            }
            return instance;
        };
        this.setStyles = function(styles){
            _.forEach(_.keys(styles), function(key){
                PDF[key].apply(PDF, styles[key] );
            });
        };
        this.setWidth = function(width){
            if ( _.isNumber(width)){
                this.width = width;
            }
            else{
                throw "ERROR, width must be a number";
            }
        };
        this.getWidth = function(){
            return this.width;
        };
        this.constructor = PDFBase;
    }).call(PDFBase.prototype);


    // PDFSection base constructor
    PDFSection = function ( settings ) {
        settings = settings || {};
        PDFBase.call(this, settings);
        if (settings.content ){
            this.addContent(settings.content);
        }
    };

    PDFSection.prototype = (function() {
        this.initialize = function(globalSettings){
            var s  = this.initSettings       || {};
            var gs = globalSettings          || {};
            PDFBase.prototype.initialize.call(this, globalSettings);
            if ( s.Header || s.header )
                this.setHeader( s.Header, this.inheritedSettings);
            if ( s.Footer || s.footer )
                this.setFooter(s.Footer, this.inheritedSettings);
    
            this.content = this.content || s.content || [];
            if ( s.FillColor || gs.FillColor ){
                this.FillColor = s.FillColor || gs.FillColor;
            }
            setProperties.call(this, {
                position        : this.position    || s.positions       || null,
                Border          : this.Border      || s.Border          || gs.Border  
                                                   || s.border          || gs.border || false,
                margin          : new Offset ( this.margin || s.margin  || { all: 0 }),
                overflowAction  : s.overflowAction || gs.overflowAction || "split",
                padding         : new Offset ( this.padding || s.padding || { all: 0 }),
                baseClass   : PDFSection
            });
            return this;
        };
        this.initializeChildren = function(){
            delete this.initSettings;
            if ( this.Header ){
                this.Header.initialize(this.inheritedSettings);
            }
            if ( this.Footer ){
                this.Footer.initialize( this.inheritedSettings );
            }
            _.forEach(this.content, function(c){
                c.initialize(this.inheritedSettings);
            }.bind(this));
        };
        this.getHeaderHeight = function(){
            return ( this.isPDFSection(this.Header)? this.Header.getHeight() : 0 );
        };
        this.getFooterHeight = function(){
            return ( this.isPDFSection(this.Footer)? this.Footer.getHeight() : 0 );
        };
        this.getHeaderFooterHeight = function(){
            return this.getHeaderHeight() + this.getFooterHeight();
        };
        this.getHeightWithoutContent = function(){
            var offset = this.margin.clone().add( this.padding );
            return this.getHeaderFooterHeight() + offset.verticalSum();
        };
        this.getBorderStyles = function(){
            if( _.has(this), "Border"){
                var styles = {};
                _.forEach(["DrawColor", "LineCap", "LineJoin", "LineWidth"], 
                           function(style){
                             if( _.has(this, "Border"+style) ){
                                styles["set"+style] = this["Border"+style];
                                if( !_.isArray(styles["set"+style])){
                                    styles["set"+style] = [styles["set"+style]];
                                }
                             }
                           }.bind(this));
                if( _.has(this, "FillColor")){
                    styles.setFillColor = this.FillColor;
                }
                return styles;
            }
            else return {};
        };
        // Wipe content and add to a PDFSection
        this.setContent =  function ( content ){
            this.content = [];
            return this.addContent(content);
        };
        // Add content to a PDFSection
        this.addContent = function ( content ) {
            this.content = this.content || [];
            var result;
            try { result = this.parseContent(content); }
            catch(e) { console.error(e); result = []; }
            if ( _.isArray(result))
                _.forEach(result, function(c){  
                    this.content.push(c); 
                }.bind(this));
            else {
                this.content.push(result);
            }
            return this;
        };
        this.parseContent = function(content){
            console.log("CONTENT: ");
            console.log(typeof content);
            console.log(this);
            if ( _.isObject( content ) && ( content.baseClass === PDFBase || content.baseClass === PDFSection )){
                if ( _.isUndefined(this.initSettings) ){
                    content.initialize(this.inheritedSettings);
                }
                return content;
            }
            else if ( _.isString( content ) ||  _.isNumber(content)){
                return new TextSection({}, this.inheritedSettings).addContent(""+content);
            }
            else if ( _.isObject ( content ) && (_.has(content, "type") || _.has(content, "image"))) {
                if ( _.has(content, "image") ){
                    content.type = "image";
                }
                switch ( content.type )  {
                    case 'text'     : return new TextSection  (content);
                    case 'row'      : return new RowSection   (content);
                    case 'column'   : // Falls through
                    case 'col'      : return new ColumnSection(content);
                    case 'image'    : return new ImageSection (content);
                }
            }
            else if ( _.isArray ( content ) ){
               return _.reduce( content, function(aggr, el){
                    try {
                        var result = this.parseContent(el);
                        return aggr.concat(result);
                    }
                    catch(e) { console.error(e); console.log(content); return aggr; }
               }.bind(this), []);
            }
            else { throw "Error, content of type " + typeof content + " was not expected."; }
        };
        this.setFooter = function(footer) {
            this.Footer = this.parseContent(footer);
            return this;
        };
        this.setHeader = function(header) {
            this.Header = this.parseContent(header);
            return this;
        };
        // Check if an object is a PDFSection
        this.isPDFSection = function ( section ) {
            return _.isObject( section ) && section.baseClass === PDFSection;
        };
    
        this.getHeight = function(){
            var contentHeight = 0;
            var max = 0;
            _.forEach( this.content, function(section) {
                if ( section.position ){
                    max = Math.max(section.getHeight(), max);
                }
                else {
                    contentHeight += section.getHeight();
                }
            }.bind(this));
            if ( this.position && (this.position.y2 > (Math.max(contentHeight, max)))) {
                return this.position.y2 + this.getHeightWithoutContent();
            }
            else if ( max > contentHeight ){
                return max + this.getHeightWithoutContent();
            }
            return this.getHeightWithoutContent() + contentHeight;
        };
    
        this.splitToWidth = function( availableWidth ){
            if ( this.initSettings ){
                this.initialize();
            }
            if ( _.isNumber( this.fixedWidth ) ){
                availableWidth = Math.min( this.fixedWidth, availableWidth );
            }
            if ( !( _.isNumber(availableWidth) )){
                throw "ERROR, no width given";
            }
            this.setWidth(availableWidth);
            var offset = this.margin.clone().add( this.padding );
            var maxWidth = availableWidth - offset.horizontalSum();
            if ( this.isPDFSection(this.Header))
                this.Header.splitToWidth( this.Header.ignorePadding? availableWidth : maxWidth);
            if ( this.isPDFSection(this.Footer))
                this.Footer.splitToWidth(this.Footer.ignorePadding? availableWidth : maxWidth);
            for ( var i = 0; i < this.content.length; i++){
                this.content[i].splitToWidth(maxWidth);
            }
            return this;
        };

        this.splitToHeight = function( availableSpace, nextPageSpace ) {
            var orig = availableSpace.clone();
            PDF.setFont(this.Font);
            PDF.setFontSize(this.FontSize);
            
            var baseHeight = this.getHeightWithoutContent();
            if ( this.getHeight() > availableSpace.getHeight() ) {
                if ( baseHeight > availableSpace.getHeight() || 
                    (baseHeight + ( PDF.internal.getLineHeight() * 3) > availableSpace.getHeight())) {
                    return { status: "newPage", overflow: this };
                }
                var search = this;
                while( search.content && search.content.length < 2){
                    if( search.content.length === 0 || _.isString(search.content[0])){
                        return  { status: "newPage", overflow: this };
                    }
                    else if( search.content.length === 1 ){
                        search = search.content[0];
                    }
                }
                if ( this.overflowAction === "split" || Math.abs(nextPageSpace.getHeight() - availableSpace.getHeight()) < 0.5){
                    var result = { status: (this.overflowAction === "split" ? "split" : "forcedSplit" ) };
                    var usedHeight = this.getHeightWithoutContent();
                    nextPageSpace.offset( { y1: this.getHeightWithoutContent()});
                    var i = 0; 
                    while ( this.content[i].getHeight() + usedHeight < availableSpace.getHeight()){
                        availableSpace.offset( { y1: this.content[ i ].getHeight()});
                        ++i;
                    }
                    if ( i === 0 ){ 
                        return { status: "newPage", overflow: this };
                    }
                    var nestedResult = this.content[i].splitToHeight(availableSpace.clone(), nextPageSpace.clone());
    
                    result.toAdd = this.clone()
                          .setContent( _.take(this.content, i))
                          .addContent( nestedResult.toAdd );
    
                    result.overflow = this.clone()
                          .setContent( nestedResult.overflow )
                          .addContent( _.drop(this.content, i + 1));
                    if ( result.toAdd.getHeight() > orig.getHeight()){
                        throw "";
                    }
                    return result;
                }
                else return { status: "newPage", overflow: this };
            }
            else return { status: "normal", toAdd: this };
        };
    
        this.renderBorderAndFill = function(renderSpace){
            var drawDim   = renderSpace.clone();
            var hasFill   = _.has(this, "FillColor");
            var hasBorder = _.has(this, "Border") && this.Border === true;
            var borderStyles = this.getBorderStyles();
            if ( hasFill || hasBorder ){
                this.setStyles( borderStyles );
                var x1 = drawDim.x1, 
                    y1 = drawDim.y1, 
                    width = drawDim.getWidth(), 
                    height = drawDim.getHeight();
                if ( hasFill && hasBorder )
                    PDF.rect( x1, y1, width, height, "FD");
                else if ( hasFill )
                    PDF.rect( x1, y1, width, height, "F");
                else  // hasBorder
                    PDF.rect( x1, y1, width, height );
            }
            return this;
        };
    
        this.render = function(renderSpace){ 
            var drawDim = renderSpace.clone().offset(this.margin);
            var styles  = this.getStyles();
            this.renderBorderAndFill(drawDim);    
            this.setStyles( styles );
            if ( this.isPDFSection( this.Header ) ){
                var headerSpace = drawDim.clone().setHeight( this.Header.getHeight());
                this.Header.render( headerSpace );
                drawDim.offset( { y1: this.Header.getHeight() } );

            }
            if ( this.isPDFSection( this.Footer ) ){
                var footerSpace = drawDim.clone().setHeight( this.Footer.getHeight(), true);
                this.Footer.render( footerSpace );
                drawDim.offset( { y2: this.Footer.getHeight() } );
            }
            drawDim.offset( this.padding );
            var contentSpace = drawDim.clone();
            _.forEach(this.content, function(section){
                var sectionSpace = _.isUndefined(section.position) || _.isNull(section.position)
                    ? drawDim.clone()
                    : contentSpace.clone().translate(section.position.x1, section.position.y1);
                section.render(sectionSpace.setHeight( section.getHeight()).setWidth(section.getWidth()));
                drawDim.offset( { y1: section.getHeight() });
            }.bind(this));
            return this;
        };
        this.constructor = PDFSection;

        return this;
    }).call( Object.create( PDFBase.prototype ) );


    // Wraps text for TextSection class ( this was to make the TextSection class more similar to the other PDFSection classes )
    function TextWrapper(settings ){
        settings = settings || {};
        this.content = [];
        if ( settings.content ){
            this.setContent(settings.content);
        }
        PDFBase.call(this, settings);
    }

    
    TextWrapper.prototype = (function() {
        this.initialize = function(globalSettings){
            PDFBase.prototype.initialize.call(this, globalSettings);            
            delete this.initSettings;
            return this;
        };
        this.setContent = function(content){
            this.content = content;
            return this;
        };
        this.getHeightWithoutContent = function(){
            var sum = 0;
            sum += Math.max( this.linePadding.top, 0);
            sum += Math.max( this.linePadding.bottom, 0);
            return sum;
        };
        this.getHeight = function(){
            PDF.setFont(this.Font);
            PDF.setFontSize(this.FontSize);
            return this.content.length * PDF.internal.getLineHeight();
        };
        this.splitToWidth = function( availableWidth  ){
            this.setWidth(availableWidth);
            var maxWidth = availableWidth - ( Math.max( this.linePadding.left, 0) + Math.max(this.linePadding.right, 0));
            this.content = PDF.splitTextToSize( this.content, maxWidth, {
                FontSize : this.FontSize,
                FontName : this.Font
            });
            return this;
        };
        this.splitToHeight = function( availableSpace ) {
            PDF.setFont(this.Font);
            PDF.setFontSize(this.FontSize);
            var maxIndex = Math.ceil( availableSpace.getHeight() / PDF.internal.getLineHeight() ) - 1;
            if ( maxIndex <= this.content.length ) { 
                return { status: "normal", toAdd: this }; 
            }
            return { 
                status   : "split",
                toAdd    : this.clone().setContent( _.take( this.content, maxIndex)),
                overflow : this.clone().setContent( _.drop( this.content, maxIndex)) 
            };
        };
        this.render = function(renderSpace){
            var drawDim   = renderSpace.clone(),
            styles        = this.getStyles();       
            drawDim.offset({ x1: this.linePadding.left, x2: this.linePadding.right });
            this.setStyles( styles );
            drawDim.offset({ y1: this.linePadding.top + PDF.internal.getLineHeight()});
            if ( this.TextColor )
                PDF.setTextColor.apply( PDF, this.TextColor );
            if ( _.isArray(this.content)){
                _.forEach(this.content, function(line){
                    PDF.text(drawDim.x1, drawDim.y1, line);
                    drawDim.offset({ y1: Math.max(this.linePadding.top, 0) + PDF.internal.getLineHeight()});
                    drawDim.offset({ y2: Math.max(this.linePadding.bottom, 0) });
                }.bind(this));
            }
            else if(_.isString(this.content)){
                console.log("WARNING: expected array in content, received type: string");
                PDF.text(drawDim.x1, drawDim.y1, this.content);
            }
            else {
                console.error("Error: expected array in content, received type: " + typeof this.content );
            }
            return this;
        };
        this.constructor = TextWrapper;
        return this;
    }).call( Object.create( PDFBase.prototype ) );


    
    // Derived PDFSection Type for containing text
    TextSection = function( settings ) {
        PDFSection.call( this, settings );
        return this;
    };

    TextSection.prototype = (function() {
        this.initialize = function(globalSettings){
            PDFSection.prototype.initialize.call(this, globalSettings);
            this.padding = new Offset({ all: 3 });
            this.initializeChildren();
            return this;
        };
        this.getHeight = function( ){
            var height = this.getHeightWithoutContent();
            _.forEach ( this.content, function(c) {
                height += c.getHeight();
            }.bind(this));
            return height;
        };
        this.addContent = function(content){
            this.content = this.content || [];
            if ( _.isUndefined(content) || _.isNull(content))
                content = "";
            if ( _.isNumber( content )){
                content = ""+content;
            }
            if ( _.isArray( content ) && content.length > 0 ){
                var allString = true;
                var allTextWrap = true;
                _.forEach( content, function(line){
                    if ( _.isNumber(line))
                        line = ""+line;
                    if ( _.isUndefined(line) || _.isNull(line)){
                        line = "";
                    }
                    allString = ( allString? _.isString( line ) : false );
                    allTextWrap = (allTextWrap? _.isObject(line) && line.constructor === TextWrapper : false);
                });
                if ( allString || allTextWrap ){
                    content = allString
                        ? [ new TextWrapper(this).setContent(content.join("\n")) ]
                        : content;
                }
            }
            else if ( _.isString( content ) || _.isNumber(content) || _.isObject(content) && content.constructor === TextWrapper ){
                content = _.isString( content )
                    ? [ new TextWrapper(this).setContent(""+content) ]
                    : [ content ];
            }
                
            if ( content.length > 0 ) {
                if (!( _.has(this.initSettings ))){
                    _.forEach( content, function(el){
                        el.initialize(this.inheritedSettings);
                    }.bind(this));
                }
                this.content = this.content.concat(content);
            }
            return this;
        };
        this.constructor = TextSection;
        return this;
    }).call( Object.create( PDFSection.prototype ));
    

    // Derived Type RowSection
    RowSection = function( settings ) {
        PDFSection.call ( this, settings );
        return this;
    };

    RowSection.prototype = (function() {
        this.initialize = function(globalSettings){
            PDFSection.prototype.initialize.call(this, globalSettings);
            this.initializeChildren();
            return this;
        };
        this.getHeight = function( ){
            var height = 0;
            _.forEach ( this.content, function(col) {
                height = Math.max( col.getHeight(), height);
            }.bind(this));
            return height + this.getHeightWithoutContent();
        };

    
        this.splitToWidth = function(availableWidth){
            if ( _.isNumber( this.fixedWidth ) ){
                availableWidth = Math.min( this.fixedWidth, availableWidth );
            }
            if ( !( _.isNumber(availableWidth) )){
                throw "ERROR, no width given";
            }
            this.setWidth(availableWidth);
            
            var offset = this.margin.clone().add( this.padding );

            if ( this.isPDFSection(this.Header))
                this.Header.splitToWidth(availableWidth - (this.Header.ignorePadding? this.padding.horizontalSum() : 0 ));
            if ( this.isPDFSection(this.Footer))
                this.Footer.splitToWidth(availableWidth - (this.Footer.ignorePadding? this.padding.horizontalSum() : 0 ));

            var widthLeft = availableWidth - offset.horizontalSum();
            
            for( var i = 0; i < this.content.length; i++ ) {
                var col = this.content[i];
                var thisWidth = widthLeft / ( this.content.length - i );
                thisWidth = (col.fixedWidth
                    ? Math.min(thisWidth, col.fixedWidth)
                    : thisWidth);
                col.splitToWidth(thisWidth);
                widthLeft -= thisWidth;
            }
            this.constructor = RowSection;
            return this;
        };
    
        this.splitToHeight = function( availableSpace, nextPageSpace ) {
            var orig = availableSpace.clone();
            if ( this.getHeight() > availableSpace.getHeight() ) {
                if ( this.overflowAction === "split" || Math.abs(nextPageSpace.getHeight() - availableSpace.getHeight()) < 0.5){
                    var result = { 
                        status   : (this.overflowAction === "split" ? "split" : "forcedSplit" ),
                        toAdd    : this.clone().setContent([]),
                        overflow : this.clone().setContent([])
                    };
                    availableSpace.offset( { y1: this.getHeightWithoutContent()});
                    nextPageSpace.offset( {y1: this.getHeightWithoutContent()});
                    for( var i = 0; i < this.content.length; ++i ){
                        var nestedResult = this.content[i].splitToHeight( availableSpace.clone(), nextPageSpace.clone() );
                        if ( nestedResult.status === "newPage"){
                            return { status: "newPage", overflow: this };
                        }
    
                        result.toAdd.addContent( nestedResult.toAdd );
                        var overflow = nestedResult.overflow || nestedResult.toAdd;
                        
                        if ( nestedResult.status === "normal" ){
                            var lastEl = overflow;
                            while( this.isPDFSection(lastEl) && lastEl.content.length > 0 && this.isPDFSection( _.last(lastEl.content) ) ){
                                lastEl.content = _.takeRight(lastEl.content, 1);
                                lastEl = lastEl.content[0];
                            }
                        }
                        result.overflow.addContent( overflow ); 

                    }
                    if ( result.toAdd.getHeight() > orig.getHeight())
                        console.error("Error calculating height");
                    return result;
                }
                else return { status: "newPage", overflow: this };
            }
            return { status: "normal", toAdd: this.clone() };
        };
    
        this.render = function(renderSpace){
            var drawDim = renderSpace.clone().offset(this.margin),
                styles  = this.getStyles();
            this.renderBorderAndFill(drawDim);
    
            drawDim.offset( this.padding );
            this.setStyles( styles );
    
            if ( this.isPDFSection( this.Header ) ){
                var headerSpace = drawDim.clone().setHeight( this.Header.getHeight());
                this.Header.render( headerSpace );
                drawDim.offset( { y1: this.Header.getHeight() } );
            }
            if ( this.isPDFSection( this.Footer ) ){
                var footerSpace = drawDim.clone().setHeight( this.Footer.getHeight());
                this.Footer.render( footerSpace );
                drawDim.offset( { y2: this.Footer.getHeight() } );
            }
            _.forEach(this.content, function(section){
                var sectionSpace = drawDim.clone().setWidth(section.getWidth());
                section.render( sectionSpace );
                drawDim.offset( { x1: section.getWidth() });
            }.bind(this));
            return this;
        };
        this.constructor = RowSection;
        return this;
    }).call( Object.create( PDFSection.prototype ));
    

    // Derived Type ColumnSection
    ColumnSection = function( settings ) {
        PDFSection.call( this, settings );
        return this;
    };
    ColumnSection.prototype = 
    
    ColumnSection.prototype = (function(){
        this.initialize = function(globalSettings){
            PDFSection.prototype.initialize.call(this, globalSettings);
            this.initializeChildren();
            return this;
        };
        this.constructor = ColumnSection;
    }).call(Object.create(PDFSection.prototype));

    ImageSection = function(settings){     
        PDFSection.call( this, settings );
       return this;
    };

    ImageSection.prototype = (function(){
        this.initialize = function(globalSettings){
            var s  = this.initSettings       || {};
            var gs = globalSettings          || {};
            PDFSection.prototype.initialize.call(this, gs);
            setProperties.call(this, {
                image   : s.image || null,
                position  : new Dimensions(s.position || {x1: 0, y1: 0, width: 0, height: 0}),
                angle     : s.angle || 0
            });
            this.initializeChildren();
            return this;
        };
        this.render = function(renderSpace){
            var origBorder = this.Border;
            var origFill = this.FillColor;
            PDFSection.prototype.renderBorderAndFill.call(this, renderSpace.clone());
            var drawSpace = renderSpace.clone();
            if ( this.position )
                drawSpace.offset(this.padding.add(this.margin));
            else {
                if ( this.fixedWidth )
                    drawSpace.setWidth(this.fixedWidth);
                if( this.fixedHeight )
                    drawSpace.setHeight( this.fixedHeight );
            }

            console.log("Image");
            console.log({ x: drawSpace.x1,
                y: drawSpace.y1,
                w: this.position.getWidth(),
                h: this.position.getHeight()});
            var uri = this.image.getURI();
            var format = uri.substring(12,15)==="png"
                ? "png"
                : "jpg";
            this.position.setWidth(this.image.width), 
            this.position.setHeight(this.image.height)
            PDF.addImage(
                this.image.getURI(), 
                format, 
                drawSpace.x1, 
                drawSpace.y1, 
                this.position.getWidth(), 
                this.position.getHeight()
            );
            delete this.FillColor;
            this.Border = false;

            PDFSection.prototype.render.call(this, renderSpace.clone().offset(this.padding.add(this.margin)));
            this.FillColor = origBorder;
            this.Border = origFill;
            return this;
        };

        this.splitToWidth = function( availableWidth ){
            if ( _.isNumber( this.fixedWidth ) || this.position ){
                availableWidth = ( this.fixedWidth || this.position? this.position.getWidth() : null);
            }
            if ( !( _.isNumber(availableWidth) )){
                throw "ERROR, no width given";
            }
            this.setWidth(availableWidth);
            var offset = this.margin.clone().add( this.padding );
            var maxWidth = availableWidth - offset.horizontalSum();
            if ( this.isPDFSection(this.Header))
                this.Header.splitToWidth( this.Header.ignorePadding? availableWidth : maxWidth);
            if ( this.isPDFSection(this.Footer))
                this.Footer.splitToWidth(this.Footer.ignorePadding? availableWidth : maxWidth);
            for ( var i = 0; i < this.content.length; i++){
                this.content[i].splitToWidth(maxWidth);
            }
            return this;
        };
        this.constructor = ImageSection;
        return this;
    }).call(Object.create(PDFSection.prototype));

    //TextMap, for conveniently placing text over a(n) background image(s) or nothing at all
    function TextMap( settings ){
        PDFSection.call( this, settings );
        return this;
    }

    TextMap.prototype = (function(){
        this.initialize = function(globalSettings){
            PDFSection.prototype.initialize.call(this, globalSettings);
            this.initializeChildren();
            return this;
        };
        // Add text at position
        this.add = function(content, x, y, w){
            if ( _.isArray(x) && x.length ==2){
                w = y;
                y = x[1];
                x = x[0];
            }
            this.addContent({ 
                type: "text", 
                content: content, 
                position: new Dimensions({ x1: x, y1: y, width: w}),
                Border: false
            });
            return this;
        };

        // Add an image at the given position
        this.addImage = function(imageData, x, y, w, h, angle){
            if ( _.isArray(x) && x.length ==2){
                angle = h;
                h = w;
                y = x[1];
                x = x[0];
            }
            
            this.addContent(new ImageSection({
                image: imageData,
                position: new Dimensions({ x1: x, y1: y, width: w, height: h }), 
                angle: angle,
                Border: false
            }));
            
            return this;
        };
        this.constructor = TextMap;
        return this;
    }).call( Object.create( PDFSection.prototype ));

    // Derived Type PDFPage
    function PDFPage( settings ) {
        PDFSection.call( this, settings );
        PDFSection.prototype.initialize.call(this);
        setProperties.call(this, {
            documentSpace: settings.documentSpace.clone(),
            pageSpace    : settings.pageSpace.clone(),
            contentSpace : settings.contentSpace.clone(),
            pageFormat   : settings.pageFormat
        });
        return this;
    }
    PDFPage.prototype = Object.create(PDFSection.prototype);
    PDFPage.prototype.constructor = PDFPage;

    // Derived Type PDFDocument
    PDFDocument = function ( settings ) {
        PDFSection.call( this, settings );        
        return this;
    };

    PDFDocument.prototype = (function() {
        this.addPage = function(){
            if ( this.currentPage !== null ){
                this.pages.push( this.currentPage.clone().setHeader(this.Header).setFooter(this.Footer) );
            }
            this.currentPage = new PDFPage(this)
            .setHeader(this.Header)
            .setFooter(this.Footer)
            .setContent([]);
            return this.currentPage;
        };
        this.render = function(){
            PDF = new jsPDF('portrait', 'pt', 'letter');
            for ( var i = 0; i < this.pages.length; i++){
                var page = this.pages[i];
                page.render(page.documentSpace.clone());
                if ( i !== this.pages.length - 1){
                    PDF.addPage();
                }
            }
            return this;
        };

        this.save = function(fileName){
            fileName = fileName || "document.pdf";
            this.render();
            PDF.save(fileName);
        };
    
        this.uri = function(){
            this.render();
            return PDF.output("datauristring");
        };
    
        this.newWindow = function(){
            this.render();
            PDF.output("datauri");
        };
    
    
        this.initialize = function() {
            PDFSection.prototype.initialize.call(this);
            var s = this.initSettings || {};
            setProperties.call(this, {
                currentPage   : null,
                pages         : [],
                documentSpace : new Dimensions( s.documentSpace || { width : 612, height : 792 }),
                pageFormat    : s.pageFormat || "portrait",
                PDFName       : s.PDFName || "PDF"
            });
            this.pageSpace = this.documentSpace.clone().offset( this.margin );
            var width = this.pageSpace.clone().offset(this.padding).getWidth();
            this.initializeChildren();
            if ( this.Header ){
                this.Header.splitToWidth(width + (this.Header.ignorePadding? this.padding.horizontalSum() : 0 ));
            }

            if ( this.isPDFSection(this.Footer)){
                this.Footer.splitToWidth(width + (this.Footer.ignorePadding? this.padding.horizontalSum() : 0 ));
            }

            
            
            this.contentSpace = this.pageSpace.clone().offset({ top: this.getHeaderHeight(), bottom: this.getFooterHeight() });
            this.addPage();
    
            _.forEach(this.content, function(section){
                section.splitToWidth(width);
                var page = this.currentPage;
                var result = section.splitToHeight(page.contentSpace.clone(), page.pageSpace.clone());
                if ( result.status !== "newPage" && result.toAdd.getHeight() > page.contentSpace.getHeight())
                    throw "Over page bounds";
                while ( result.status !== "normal" ) {
                    if ( result === "split" || result === "forcedSplit"){
                        page.addContent( result.toAdd );
                        page.contentSpace.offset( { y1: result.toAdd.getHeight() });
                    }
                    // Executes for both "split" and "newPage" results
                    page = this.addPage();
                    result = result.overflow.splitToHeight( page.contentSpace, page.pageSpace );
                }
                if ( result.status === "normal"){
                    this.currentPage.addContent( result.toAdd );
                    page.contentSpace.offset( { y1: result.toAdd.getHeight() });
                }
            }.bind(this));
            if( this.currentPage.content.length > 0)
                this.addPage();
            return this;
        };
        this.constructor = PDFDocument;
        
        return this;
    }).call( Object.create( PDFSection.prototype ));


    
//}());

function Offset( _offset, _right, _bottom, _left ) {
    this.set = function(offset, right, bottom, left){
        if ( _.isObject( offset ) ) {
            if ( _.has( offset, "all" ) ){
                return this.set(offset.all, offset.all, offset.all, offset.all);
            }
            this.top    = offset.top    || this.top     || 0;
            this.right  = offset.right  || this.right   || 0;
            this.bottom = offset.bottom || this.bottom  || 0;
            this.left   = offset.left   || this.left    || 0;
        }
        else {
            this.top    = offset || this.top     || 0;
            this.right  = right  || this.right   || 0;
            this.bottom = bottom || this.bottom  || 0;
            this.left   = left   || this.left    || 0;
        }
        return this;
    }.bind(this);

    this.set(_offset, _right, _bottom, _left);

    this.clone = function(){
        return new Offset(this);
    }.bind(this);

    this.add = function( offset, right, bottom, left ) {
        if ( _.isObject( offset ) ) {
            this.top    += ( offset.top    || 0 );
            this.right  += ( offset.right  || 0 );
            this.bottom += ( offset.bottom || 0 );
            this.left   += ( offset.left   || 0 );
        }
        else {
            this.top    += ( offset || 0 );
            this.right  += ( right  || 0 );
            this.bottom += ( bottom || 0 );
            this.left   += ( left   || 0 );
        }
        return this;
    }.bind(this);

    this.negate = function(flags, negRight, negbottom, negleft) {
        if( _.isUndefined(flags) ){
            flags = { top:true, bottom:true, left:true, right:true };
        }
        if ( _.isObject( flags ) ) {
            this.top    = flags.top    ? (0 - this.top)    : this.top;
            this.right  = flags.right  ? (0 - this.right)  : this.right;
            this.bottom = flags.bottom ? (0 - this.bottom) : this.bottom;
            this.left   = flags.left   ? (0 - this.left)   : this.left;
        }
        else {
            this.top    = flags        ? (0 - this.top)    : this.top;
            this.right  = negRight     ? (0 - this.right)  : this.right;
            this.bottom = negbottom    ? (0 - this.bottom) : this.bottom;
            this.left   = negleft      ? (0 - this.left)   : this.left;
        }
        return this;
    };

    this.verticalSum = function(){
        return this.top + this.bottom;
    }.bind(this);

    this.horizontalSum = function(){
        return this.left + this.right;
    }.bind(this);
}

function Dimensions( _dim, _x2, _y1, _y2 ) {
    this.set = function(dim, x2, y1, y2 ) {
        if ( _.isObject( dim ) ) {
            this.x1 = dim.x1 || 0;  
            this.y1 = dim.y1 || 0;
            this.x2 = dim.x2 || ( this.x1 + ( dim.width  || 0 ) );
            this.y2 = dim.y2 || ( this.y1 + ( dim.height || 0 ) );
        }
        else {
            this.x1 = dim || 0;
            this.x2 = x2  || this.x1;
            this.y1 = y1  || 0;
            this.y2 = y2  || this.y1;
        }
        return this;
    }.bind(this);

    this.set(_dim, _x2, _y1, _y2);

    this.clone = function(){
        return new Dimensions( this.x1, this.x2, this.y1, this.y2 );
    };

    this.setWidth = function( width, adjustLeftCoordinate ) {
        if ( _.isNumber( width ) ) { 
            if ( adjustLeftCoordinate === true ) { this.x1 = this.x2 - width; }
            else { this.x2 = this.x1 + width; }
            return this;
        }
        else {
            throw "ERROR: Width must be a number!";
        }
    }.bind(this);

    this.getWidth = function(){
        return this.x2 - this.x1;
    }.bind( this );

    this.setHeight = function( height, adjustTopCoordinate ) {
        if ( _.isNumber( height ) ) { 
            if ( adjustTopCoordinate === true ) { this.y1 = this.y2 - height; }
            else { this.y2 = this.y1 + height; }
            return this;
        }
        else {
            throw "ERROR: Height must be a number";
        }
    }.bind(this);

    this.getHeight = function(){
        return this.y2 - this.y1;
    }.bind( this );

    this.offset = function( _dim, x2, y1, y2 ) {

        if ( _.isNumber(_dim) && _.isUndefined(x2) 
            && _.isUndefined(y1) && _.isUndefined(y2)){
            console.log ( "WARNING: Only a single number was supplied as an offset.  Are you sure you didn't mean to pass an object?");
        }

        // bottom/y2 and right/X2 are assumed to be an offset inward, kind of like css uses right and bottom
        if ( _.isObject( _dim ) ) {
            this.x1 += ( _dim.x1 || _dim.left   || 0 );
            this.x2 -= ( _dim.x2 || _dim.right  || 0 );
            this.y1 += ( _dim.y1 || _dim.top    || 0 );
            this.y2 -= ( _dim.y2 || _dim.bottom || 0 );
        }
        else {
            this.x1 = this.x1 + _dim || 0;
            this.x2 = this.x2 - x2   || 0;
            this.y1 = this.y1 + y1   || 0;
            this.y2 = this.y2 - y2   || 0;
        }
        return this;
    }.bind( this );
    this.translate = function( x, y ){
        if ( _.isObject(x) ){
            y = x.y || 0;
            x = x.x || 0;
        }
        this.x1 += x;
        this.x2 += x;
        this.y1 += y;
        this.y2 += y;
        return this;
    }.bind(this);
}

function ImageData(image, width, height) {
    this.image     = new Image();
    this.image.src = image;
    this.image.onload = function(){
        this.width  = width  || this.image.naturalWidth;
        if (width && !height){
            var scale = width / this.image.naturalWidth;
            this.height = this.image.naturalHeight * scale;
        }
        else {
            this.height = height || this.image.naturalHeight;
        }
    }.bind(this);
    this.getURI = function(format, quality){
        var width   = this.image.naturalWidth;
        var height  = this.image.naturalHeight;
        var canvas  = document.createElement('canvas');
        var context = canvas.getContext('2d');
        if ( format !== "png" && format !== "jpeg")
            format = "png";
        format = "image/" + (format || "png");
        canvas.width  = width;
        canvas.height = height;
        context.drawImage(this.image, 0, 0, width, height);
        return canvas.toDataURL(format, quality);
    }
    return this;
}

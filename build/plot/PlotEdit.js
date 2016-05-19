define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/dom",
    "dojo/Evented",
    "./constants",
    "./plotUtils",
    "./domUtils",
    "esri/geometry/Point",
    "esri/geometry/Polyline",
    "esri/geometry/Polygon",
    "esri/graphic",
    "esri/Color",
    "esri/symbols/SimpleMarkerSymbol",
    "esri/symbols/SimpleLineSymbol"
], function (declare, lang, dom, Evented, constants, plotUtils, domUtils, Point, Polyline, Polygon, Graphic, Color, SimpleMarkerSymbol, SimpleLineSymbol) {
    var PlotEdit = declare([Evented], {
        constructor: function (map) {
            if (!map)
                return;
            var lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color("#000000"), 1);
            this.controlPointSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 12, lineSymbol, new Color("#003388"));
            this._map = map;
            this._graphic = null;
            this._startPoint = null;
            this._controlPointGraphics = null;
            this._activeControlPointGraphic = null;
            this._layerMouseOverHandler = lang.hitch(this, this._layerMouseOverHandler);
            this._layerMouseOutHandler = lang.hitch(this, this._layerMouseOutHandler);
            this._layerMouseDownHandler = lang.hitch(this, this._layerMouseDownHandler);
            this._layerMouseMoveHandler = lang.hitch(this, this._layerMouseMoveHandler);
            this._layerMouseUpHandler = lang.hitch(this, this._layerMouseUpHandler);
            this._controlPointLayerMouseDownHandler = lang.hitch(this, this._controlPointLayerMouseDownHandler);
            this._controlPointLayerMouseMoveHandler = lang.hitch(this, this._controlPointLayerMouseMoveHandler);
            this._controlPointLayerMouseUpHandler = lang.hitch(this, this._controlPointLayerMouseUpHandler);
        },
        activate: function (graphic) {
            if (!graphic || !graphic.plot || !graphic.plot.isPlot() || graphic == this._graphic) {
                return;
            }
            this.deactivate();
            this._graphic = graphic;
            this._initControlPoints();
            this._layerMouseOver_Connect = this._graphic.getLayer().on("mouse-over", this._layerMouseOverHandler);
            this._layerMouseOut_Connect = this._graphic.getLayer().on("mouse-out", this._layerMouseOutHandler);
        },
        deactivate: function () {
            this._graphic = null;
            this._clearControlPoints();
            this._activeControlPointGraphic = null;
            this._startPoint = null;
            if (this._layerMouseOver_Connect)
                this._layerMouseOver_Connect.remove();
            if (this._layerMouseOut_Connect)
                this._layerMouseOut_Connect.remove();
            if (this._layerMouseDown_Connect)
                this._layerMouseDown_Connect.remove();
            if (this._layerMouseMove_Connect)
                this._layerMouseMove_Connect.remove();
            if (this._layerMouseUp_Connect)
                this._layerMouseUp_Connect.remove();
            if (this._controlPointLayerMouseDown_Connect)
                this._controlPointLayerMouseDown_Connect.remove();
            if (this._controlPointLayerMouseMove_Connect)
                this._controlPointLayerMouseMove_Connect.remove();
            if (this._controlPointLayerMouseUp_Connect)
                this._controlPointLayerMouseUp_Connect.remove();
        },
        _initControlPoints: function () {
            if (!this._map) {
                return;
            }
            this._controlPointGraphics = [];
            var cPnts = this._getControlPoints();
            if (!cPnts || cPnts.length <= 0)
                return;
            for (var i = 0; i < cPnts.length; i++) {
                var point = new Point(cPnts[i][0], cPnts[i][1]);
                point.spatialReference = this._map.spatialReference;
                var graphic = new Graphic(point, this.controlPointSymbol);
                this._controlPointGraphics.push(graphic);
                this._map.graphics.add(graphic);
            }
            this._controlPointLayerMouseDown_Connect = this._map.graphics.on("mouse-down", this._controlPointLayerMouseDownHandler);
        },
        _clearControlPoints: function () {
            if (this._controlPointGraphics && this._controlPointGraphics.length > 0) {
                for (var i = 0; i < this._controlPointGraphics.length; i++) {
                    this._map.graphics.remove(this._controlPointGraphics[i]);
                }
                this._controlPointGraphics = null;
            }
        },
        _controlPointLayerMouseDownHandler: function (e) {
            if (this._controlPointGraphics && this._controlPointGraphics.indexOf(e.graphic) >= 0) {
                this._activeControlPointGraphic = e.graphic;
                this._controlPointLayerMouseMove_Connect = this._map.graphics.on("mouse-move", this._controlPointLayerMouseMoveHandler);
                this._controlPointLayerMouseUp_Connect = this._map.graphics.on("mouse-up", this._controlPointLayerMouseUpHandler);
            }
        },
        _controlPointLayerMouseMoveHandler: function (e) {
            if (this._activeControlPointGraphic) {
                this._activeControlPointGraphic.setGeometry(e.mapPoint);
                var index = this._controlPointGraphics.indexOf(this._activeControlPointGraphic);
                this._graphic.plot.updatePoint([e.mapPoint.x, e.mapPoint.y], index);
                this._graphic.setGeometry(this._generateGeometry(this._graphic.plot));
            }
        },
        _controlPointLayerMouseUpHandler: function (e) {
            this._activeControlPointGraphic = null;
            this._controlPointLayerMouseDown_Connect.remove();
            this._controlPointLayerMouseMove_Connect.remove();
            this._controlPointLayerMouseUp_Connect.remove();
        },
        _layerMouseOverHandler: function (e) {
            if (this._graphic && this._graphic == e.graphic) {
                this._map.setMapCursor("move");
                this._layerMouseDown_Connect = this._graphic.getLayer().on("mouse-down", this._layerMouseDownHandler);
            }
        },
        _layerMouseOutHandler: function (e) {
            this._map.setMapCursor("default");
            if (this._layerMouseDown_Connect)
                this._layerMouseDown_Connect.remove();
        },
        _layerMouseDownHandler: function (e) {
            this._startPoint = e.mapPoint;
            //this._map.disablePan();
            this._layerMouseMove_Connect = this._graphic.getLayer().on('mouse-move', this._layerMouseMoveHandler);
            this._layerMouseUp_Connect = this._graphic.getLayer().on('mouse-up', this._layerMouseUpHandler);
        },
        _layerMouseMoveHandler: function (e) {
            if (this._activeControlPointGraphic)
                return;
            var dx = e.mapPoint.x - this._startPoint.x;
            var dy = e.mapPoint.y - this._startPoint.y;
            var newPoints = [];
            for (var i = 0; i < this._controlPointGraphics.length; i++) {
                var p = this._controlPointGraphics[i].geometry;
                var coordinate = [p.x + dx, p.y + dy];
                this._startPoint = e.mapPoint;
                var geometry = new Point(coordinate);
                geometry.spatialReference = this._map.spatialReference;
                this._controlPointGraphics[i].setGeometry(geometry);
                newPoints.push(coordinate);
            }
            this._graphic.plot.setPoints(newPoints);
            this._graphic.setGeometry(this._generateGeometry(this._graphic.plot));
        },
        _layerMouseUpHandler: function (e) {
            //this._map.enablePan();
            this._layerMouseDown_Connect.remove();
            this._layerMouseMove_Connect.remove();
            this._layerMouseUp_Connect.remove();
        },
        _getControlPoints: function () {
            if (!this._graphic) {
                return [];
            }
            var plot = this._graphic.plot;
            return plot.getPoints();
        },
        _generateGeometry: function (plot) {
            var geometry;
            if (plot.geometryType === "point") {
                geometry = new Point(plot.x, plot.y);
            }
            else if (plot.geometryType === "polyline") {
                geometry = new Polyline(plot.paths);
            }
            else if (plot.geometryType === "polygon") {
                geometry = new Polygon(plot.paths);
            }
            geometry.spatialReference = this._map.spatialReference;
            return geometry;
        }
    });
    return PlotEdit;
});
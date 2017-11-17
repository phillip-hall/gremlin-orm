const Model = require('./model');

/**
* @param {string} label
* @param {object} schema
* @param {object} gorm
*/
class VertexModel extends Model {
  constructor(label, schema, gorm) {
    super(gorm, '')
    this.label = label;
    this.schema = schema;
  }

  /**
  * Creates a new vertex
  * @param {object} props
  */
  create(props, callback) {
    const checkSchemaResponse = this.checkSchema(this.schema, props, true);
    if (this.interpretCheckSchema(checkSchemaResponse)) {
      callback(checkSchemaResponse);
      return;
    }
    let gremlinStr = `g.addV('${this.label}')`;
    if (this.g.dialect === this.g.DIALECTS.AZURE) {
      gremlinStr += `.property('${this.g.partition}', '${props[Object.keys(props)[0]]}')`;
    }
    gremlinStr += this.actionBuilder('property', props);
    return this.executeQuery(gremlinStr, callback, true);
  }

  /**
  * Creates a new edge
  * @param {string} edge
  * @param {object} props
  * @param {object} vertex
  */
  createEdge(edgeModel, properties, vertex, callback) {
    let label, props, model;
    if (typeof edgeModel === 'string') {
      label = edgeModel;
      props = properties;
      model = new this.g.edgeModel('fake', {}, this.g)
    }
    else {
      label = edgeModel.label;
      props = this.parseProps(properties, edgeModel);
      model = edgeModel;
    }

    let outGremlinStr = this.getGremlinStr();
    let inGremlinStr = vertex.getGremlinStr();
    if (outGremlinStr === '') {
      return callback({'error': 'Gremlin Query has not been initialised for out Vertex'});
    }
    else if (inGremlinStr === '') {
      return callback({'error': 'Gremlin Query has not been initialised for in Vertex'});
    }
    if (typeof edgeModel !== 'string') {
      const checkSchemaResponse = this.checkSchema(edgeModel.schema, props, true);
      if (this.interpretCheckSchema(checkSchemaResponse)) {
        callback(checkSchemaResponse);
        return;
      }
    }

    inGremlinStr = inGremlinStr.slice(1);

    const [ a ] = this.getRandomVariable();
    let gremlinQuery = outGremlinStr + `.as('${a}')` + inGremlinStr;
    gremlinQuery += `.addE('${label}')${this.actionBuilder('property', props)}.from('${a}')`;
    let executeBound = this.executeOrPass.bind(model);
    return executeBound(gremlinQuery, callback);
  }

  /**
  * Finds first vertex with matching properties
  * @param {object} properties
  */
  find(properties, callback) {
    const props = this.parseProps(properties);
    let gremlinStr = `g.V(${this.getIdFromProps(props)}).hasLabel('${this.label}')` + this.actionBuilder('has', props);
    gremlinStr += ".limit(1)";
    return this.executeOrPass(gremlinStr, callback, true);
  }

  /**
  * Finds all vertexes with matching properties
  * @param {object} properties
  */
  findAll(properties, callback) {
    const props = this.parseProps(properties);
    let gremlinStr = `g.V(${this.getIdFromProps(props)}).hasLabel('${this.label}')` + this.actionBuilder('has', props);
    return this.executeOrPass(gremlinStr, callback);
  }

  /**
  * find all vertexes connected to initial vertex(es) through a type of edge with optional properties
  * @param {string} label
  * @param {object} properties
  * @param {number} depth
  */

  findRelated(edgeModel, properties, depth, callback) {
    let label, props;
    if (typeof edgeModel === 'string') {
      label = edgeModel;
      props = properties;
    }
    else {
      label = edgeModel.label;
      props = this.parseProps(properties, edgeModel);
    }
    let gremlinStr = this.getGremlinStr();
    for (let i = 0; i < depth; i += 1) {
      gremlinStr += `.outE('${label}')${this.actionBuilder('has', props)}.inV()`;
    }
    return this.executeOrPass(gremlinStr, callback);
  }

  /**
  * find all edges connected to initial vertex(es) with matching label and optional properties
  * @param {string} label
  * @param {object} props
  * @param {number} depth
  */
  findEdge(edgeModel, properties, callback) {
    let label, props, model;
    if (typeof edgeModel === 'string') {
      label = edgeModel;
      props = properties;
      model = new this.g.edgeModel('fake', {}, this.g)
    }
    else {
      label = edgeModel.label;
      props = this.parseProps(properties, edgeModel);
      model = edgeModel;
    }
    let gremlinStr = this.getGremlinStr();
    gremlinStr += `.bothE('${label}')${this.actionBuilder('has', props)}`;
    let executeBound = this.executeOrPass.bind(model);
    return executeBound(gremlinStr, callback);
  }

  /**
  * find all vertexes which have the same edge relations in that the current vertex(es) has out to another vertex
  * @param {string} label
  * @param {object} properties
  */
  findImplicit(edgeModel, properties, callback) {
    let label, props, model;
    if (typeof edgeModel === 'string') {
      label = edgeModel;
      props = properties;
    }
    else {
      label = edgeModel.label;
      props = this.parseProps(properties, edgeModel);
    }
    let gremlinStr = this.getGremlinStr();
    let originalAs = this.getRandomVariable()[0];
    gremlinStr += `.as('${originalAs}').outE('${label}')${this.actionBuilder('has', props)}` +
                  `inV().inE('${label}')${this.actionBuilder('has', props)}.outV()` +
                  `.where(neq('${originalAs}'))`;
    return this.executeOrPass(gremlinStr, callback);
  }
}



module.exports = VertexModel;

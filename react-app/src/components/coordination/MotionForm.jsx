import React from 'react';

const MotionForm = ({ motionTitleRef, motionTitle, setMotionTitle, motionDescription, setMotionDescription, motionSpecial, setMotionSpecial, onSubmit, onCancel }) => {
  return (
    <section className="motion-form" style={{ display: 'block' }}>
      <h3>Propose a New Motion</h3>
      <form onSubmit={onSubmit}>
        <div className="field-pair">
          <input ref={motionTitleRef} className="form-input" type="text" placeholder="Motion Title" value={motionTitle} onChange={e => setMotionTitle(e.target.value)} />
          <textarea className="form-textarea" placeholder="Description (optional)" rows="3" value={motionDescription} onChange={e => setMotionDescription(e.target.value)}></textarea>
        </div>
        <div className="form-buttons" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <button type="submit" className="primary-btn">Submit Motion</button>
          <button type="button" className="secondary-btn" onClick={onCancel}>Cancel</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, marginLeft: 6, whiteSpace: 'nowrap', height: '36px' }}>
            <input type="checkbox" checked={motionSpecial} onChange={e => setMotionSpecial(e.target.checked)} style={{ marginLeft: 6, marginTop: 0, marginBottom: 0, alignSelf: 'center' }} />
            <span style={{ marginLeft: 6, lineHeight: '1', alignSelf: 'center' }}>Special Motion</span>
          </label>
        </div>
      </form>
    </section>
  );
};

export default MotionForm;
